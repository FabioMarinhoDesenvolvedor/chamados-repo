import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Complexity, Priority, TicketStatus } from '@chamados/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { buildTicketEmail } from '../notifications/notification-email';

@Injectable()
export class TicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(where: Prisma.TicketWhereInput) {
    return this.prisma.ticket.findMany({ where, orderBy: [{ createdAt: 'desc' }] });
  }

  // Listagem paginada (nunca carrega tudo). Inclui categoria/subcategoria sem N+1.
  findManyPaginated(where: Prisma.TicketWhereInput, skip: number, take: number) {
    return this.prisma.ticket.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take,
      include: { category: true, subcategory: true, detailOption: true, department: { select: { priorityWeight: true } } },
    });
  }

  count(where: Prisma.TicketWhereInput) {
    return this.prisma.ticket.count({ where });
  }

  // KPIs: contagem por status no banco (groupBy), respeitando a visibilidade por papel.
  groupByStatus(where: Prisma.TicketWhereInput) {
    return this.prisma.ticket.groupBy({ by: ['status'], where, _count: { _all: true } });
  }

  // Contagem de não-lidos direto no banco (sem carregar os chamados). O escopo espelha a
  // visibilidade por papel: `onlyOwn` (USER) filtra por solicitante; `executorDepartmentId`
  // (OPERATOR escopado) filtra pelo setor executor.
  async countUnread(
    userId: number,
    scope: { onlyOwn: boolean; executorDepartmentId?: number },
  ): Promise<number> {
    const ownFilter = scope.onlyOwn ? Prisma.sql`AND t.requester_id = ${userId}` : Prisma.empty;
    const deptFilter = scope.executorDepartmentId
      ? Prisma.sql`AND t.executor_department_id = ${scope.executorDepartmentId}`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM tickets t
      WHERE t.last_activity_by IS DISTINCT FROM ${userId}
        ${ownFilter}
        ${deptFilter}
        AND NOT EXISTS (
          SELECT 1 FROM ticket_read_state r
          WHERE r.ticket_id = t.id
            AND r.user_id = ${userId}
            AND r.last_seen_at >= t.last_activity_at
        )`;
    return Number(rows[0]?.count ?? 0);
  }

  findById(id: number) {
    return this.prisma.ticket.findUnique({ where: { id } });
  }

  findDetail(id: number) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: {
        requester: true,
        assignee: true,
        department: true,
        executorDepartment: true,
        category: true,
        subcategory: true,
        detailOption: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: true,
            attachments: { orderBy: { createdAt: 'asc' } },
          },
        },
        history: { orderBy: { createdAt: 'asc' } },
        attachments: { where: { commentId: null }, orderBy: { createdAt: 'asc' } },
      },
    });
  }

  findComment(id: number) {
    return this.prisma.ticketComment.findUnique({ where: { id } });
  }

  findAttachment(id: number) {
    return this.prisma.ticketAttachment.findUnique({ where: { id } });
  }

  createAttachments(
    ticketId: number,
    commentId: number | null,
    items: { filename: string; originalName: string; mime: string; size: number }[],
  ) {
    return this.prisma.ticketAttachment.createManyAndReturn({
      data: items.map((i) => ({ ticketId, commentId, ...i })),
    });
  }

  createWithHistory(input: {
    title: string;
    description: string | null;
    categoryId: number;
    subcategoryId: number;
    detailOptionId: number | null;
    complexity: Complexity;
    priority: Priority;
    status: TicketStatus;
    departmentId: number;
    executorDepartmentId: number;
    requesterId: number;
    originLocation: string | null;
    notification?: {
      toEmail: string;
      emailInput: Omit<Parameters<typeof buildTicketEmail>[0], 'ticketId'>;
    };
  }) {
    return this.prisma.$transaction(async (tx) => {
      // Prioridade/SLA sempre calculados na criação (regra aprovada), independente
      // do chamado nascer OPEN ou PENDING_APPROVAL (aprovação não represa o SLA).
      const ticket = await tx.ticket.create({
        data: {
          title: input.title,
          description: input.description,
          category: { connect: { id: input.categoryId } },
          subcategory: { connect: { id: input.subcategoryId } },
          detailOption: input.detailOptionId
            ? { connect: { id: input.detailOptionId } }
            : undefined,
          complexity: input.complexity,
          priority: input.priority,
          status: input.status,
          slaStartedAt: new Date(),
          department: { connect: { id: input.departmentId } },
          executorDepartment: { connect: { id: input.executorDepartmentId } },
          requester: { connect: { id: input.requesterId } },
          originLocation: input.originLocation,
          lastActivityAt: new Date(),
          lastActivityBy: input.requesterId,
        },
        include: { department: { select: { priorityWeight: true } } },
      });
      await tx.ticketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          fromStatus: null,
          toStatus: input.status,
          changedBy: input.requesterId,
        },
      });
      // Enqueue da notificação na MESMA transação (outbox): se o chamado commita, o e-mail
      // está garantido na fila; se dá rollback, nada de e-mail órfão.
      if (input.notification) {
        const email = buildTicketEmail({
          ticketId: ticket.id,
          ...input.notification.emailInput,
        });
        await tx.notificationOutbox.create({
          data: {
            ticketId: ticket.id,
            toEmail: input.notification.toEmail,
            subject: email.subject,
            body: email.body,
          },
        });
      }
      return ticket;
    });
  }

  updateStatusWithHistory(input: {
    id: number;
    fromStatus: TicketStatus;
    toStatus: TicketStatus;
    changedBy: number;
    resolvedAt: Date | null;
    firstResponseAt?: Date; // gravado só quando informado (1º IN_PROGRESS)
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: input.id },
        data: {
          status: input.toStatus,
          resolvedAt: input.resolvedAt,
          firstResponseAt: input.firstResponseAt,
          lastActivityAt: new Date(),
          lastActivityBy: input.changedBy,
        },
        include: { department: { select: { priorityWeight: true } } },
      });
      await tx.ticketStatusHistory.create({
        data: {
          ticketId: input.id,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          changedBy: input.changedBy,
        },
      });
      return ticket;
    });
  }

  closeWithRating(input: {
    id: number;
    fromStatus: TicketStatus;
    changedBy: number;
    rating: number | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: input.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          rating: input.rating,
          lastActivityAt: new Date(),
          lastActivityBy: input.changedBy,
        },
      });
      await tx.ticketStatusHistory.create({
        data: {
          ticketId: input.id,
          fromStatus: input.fromStatus,
          toStatus: 'CLOSED',
          changedBy: input.changedBy,
        },
      });
      return ticket;
    });
  }

  applyTriage(input: {
    id: number;
    complexity: Complexity | null;
    priority: Priority | null;
    departmentId: number;
    moveToOpen: boolean;
    changedBy: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: input.id },
        data: {
          complexity: input.complexity,
          priority: input.priority,
          departmentId: input.departmentId,
          status: input.moveToOpen ? 'OPEN' : undefined,
          slaStartedAt: input.moveToOpen ? new Date() : undefined,
          lastActivityAt: new Date(),
          lastActivityBy: input.changedBy,
        },
        include: { department: { select: { priorityWeight: true } } },
      });
      if (input.moveToOpen) {
        await tx.ticketStatusHistory.create({
          data: {
            ticketId: input.id,
            fromStatus: 'TRIAGE',
            toStatus: 'OPEN',
            changedBy: input.changedBy,
          },
        });
      }
      return ticket;
    });
  }

  assign(id: number, assignedTo: number, setFirstResponse: boolean) {
    return this.prisma.ticket.update({
      where: { id },
      data: {
        assignedTo,
        // Grava a 1ª resposta só se ainda não houver (o service decide passando o flag).
        firstResponseAt: setFirstResponse ? new Date() : undefined,
      },
      include: { department: { select: { priorityWeight: true } } },
    });
  }

  addComment(ticketId: number, authorId: number, body: string) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.ticketComment.create({
        data: { ticketId, authorId, body },
        include: { author: true },
      });
      await tx.ticket.update({
        where: { id: ticketId },
        data: { lastActivityAt: new Date(), lastActivityBy: authorId },
      });
      return comment;
    });
  }

  markSeen(userId: number, ticketId: number) {
    return this.prisma.ticketReadState.upsert({
      where: { userId_ticketId: { userId, ticketId } },
      update: { lastSeenAt: new Date() },
      create: { userId, ticketId },
    });
  }

  findReadStates(userId: number, ticketIds: number[]) {
    return this.prisma.ticketReadState.findMany({
      where: { userId, ticketId: { in: ticketIds } },
    });
  }
}
