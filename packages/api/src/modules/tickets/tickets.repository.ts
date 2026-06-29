import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Complexity, Priority, TicketStatus } from '@chamados/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(where: Prisma.TicketWhereInput) {
    return this.prisma.ticket.findMany({ where, orderBy: [{ createdAt: 'desc' }] });
  }

  findById(id: string) {
    return this.prisma.ticket.findUnique({ where: { id } });
  }

  findDetail(id: string) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: {
        requester: true,
        assignee: true,
        department: true,
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

  findComment(id: string) {
    return this.prisma.ticketComment.findUnique({ where: { id } });
  }

  findAttachment(id: string) {
    return this.prisma.ticketAttachment.findUnique({ where: { id } });
  }

  createAttachments(
    ticketId: string,
    commentId: string | null,
    items: { filename: string; originalName: string; mime: string; size: number }[],
  ) {
    return this.prisma.ticketAttachment.createManyAndReturn({
      data: items.map((i) => ({ ticketId, commentId, ...i })),
    });
  }

  createWithHistory(input: {
    title: string;
    description: string;
    departmentId: string;
    requesterId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          title: input.title,
          description: input.description,
          complexity: null,
          priority: null,
          status: 'TRIAGE',
          department: { connect: { id: input.departmentId } },
          requester: { connect: { id: input.requesterId } },
          lastActivityAt: new Date(),
          lastActivityBy: input.requesterId,
        },
      });
      await tx.ticketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          fromStatus: null,
          toStatus: 'TRIAGE',
          changedBy: input.requesterId,
        },
      });
      return ticket;
    });
  }

  updateStatusWithHistory(input: {
    id: string;
    fromStatus: TicketStatus;
    toStatus: TicketStatus;
    changedBy: string;
    resolvedAt: Date | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: input.id },
        data: {
          status: input.toStatus,
          resolvedAt: input.resolvedAt,
          lastActivityAt: new Date(),
          lastActivityBy: input.changedBy,
        },
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
    id: string;
    fromStatus: TicketStatus;
    changedBy: string;
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
    id: string;
    complexity: Complexity | null;
    priority: Priority | null;
    departmentId: string;
    moveToOpen: boolean;
    changedBy: string;
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

  assign(id: string, assignedTo: string) {
    return this.prisma.ticket.update({ where: { id }, data: { assignedTo } });
  }

  addComment(ticketId: string, authorId: string, body: string) {
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

  markSeen(userId: string, ticketId: string) {
    return this.prisma.ticketReadState.upsert({
      where: { userId_ticketId: { userId, ticketId } },
      update: { lastSeenAt: new Date() },
      create: { userId, ticketId },
    });
  }

  findReadStates(userId: string, ticketIds: string[]) {
    return this.prisma.ticketReadState.findMany({
      where: { userId, ticketId: { in: ticketIds } },
    });
  }
}
