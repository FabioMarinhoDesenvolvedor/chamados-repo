import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogItem, UserActivityReport } from '@chamados/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { attachmentUrl } from '../tickets/attachments.config';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async userActivity(query: ReportQueryDto): Promise<UserActivityReport> {
    const userId = query.userId;
    const from = query.from ? new Date(`${query.from}T00:00:00.000`) : undefined;
    const to = query.to ? new Date(`${query.to}T23:59:59.999`) : undefined;
    const createdAt: Prisma.DateTimeFilter | undefined =
      from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

    // Filtro por categoria/subcategoria (aplicado direto no ticket ou via relação).
    const categoryWhere: Prisma.TicketWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.subcategoryId ? { subcategoryId: query.subcategoryId } : {}),
    };
    const hasCategoryFilter = Object.keys(categoryWhere).length > 0;
    const ticketRelationFilter = hasCategoryFilter ? { ticket: categoryWhere } : {};

    const [tickets, statusChanges, comments] = await Promise.all([
      this.prisma.ticket.findMany({
        where: {
          ...(userId ? { requesterId: userId } : {}),
          ...(createdAt ? { createdAt } : {}),
          ...categoryWhere,
        },
        include: {
          requester: true,
          category: true,
          subcategory: true,
          attachments: { where: { commentId: null }, orderBy: { createdAt: 'asc' } },
        },
      }),
      // fromStatus != null exclui o registro de criação (TRIAGE inicial), já coberto por "abriu".
      this.prisma.ticketStatusHistory.findMany({
        where: {
          fromStatus: { not: null },
          ...(userId ? { changedBy: userId } : {}),
          ...(createdAt ? { createdAt } : {}),
          ...ticketRelationFilter,
        },
        include: {
          ticket: { include: { category: true, subcategory: true } },
          changedByUser: true,
        },
      }),
      this.prisma.ticketComment.findMany({
        where: {
          ...(userId ? { authorId: userId } : {}),
          ...(createdAt ? { createdAt } : {}),
          ...ticketRelationFilter,
        },
        include: {
          ticket: { include: { category: true, subcategory: true } },
          author: true,
          attachments: { orderBy: { createdAt: 'asc' } },
        },
      }),
    ]);

    const items: ActivityLogItem[] = [
      ...tickets.map((t) => ({
        at: t.createdAt.toISOString(),
        type: 'TICKET_OPENED' as const,
        actorId: t.requesterId,
        actorName: t.requester.name,
        ticketId: t.id,
        ticketTitle: t.title,
        ticketStatus: t.status,
        ticketPriority: t.priority,
        ticketCategory: t.category?.name ?? null,
        ticketSubcategory: t.subcategory?.name ?? null,
        fromStatus: null,
        toStatus: null,
        comment: null,
        attachments: t.attachments.map((a) => ({
          url: attachmentUrl(a.ticketId, a.id),
          originalName: a.originalName,
        })),
      })),
      ...statusChanges.map((s) => ({
        at: s.createdAt.toISOString(),
        type: 'STATUS_CHANGED' as const,
        actorId: s.changedBy,
        actorName: s.changedByUser.name,
        ticketId: s.ticketId,
        ticketTitle: s.ticket.title,
        ticketStatus: s.ticket.status,
        ticketPriority: s.ticket.priority,
        ticketCategory: s.ticket.category?.name ?? null,
        ticketSubcategory: s.ticket.subcategory?.name ?? null,
        fromStatus: s.fromStatus,
        toStatus: s.toStatus,
        comment: null,
        attachments: [],
      })),
      ...comments.map((c) => ({
        at: c.createdAt.toISOString(),
        type: 'COMMENTED' as const,
        actorId: c.authorId,
        actorName: c.author.name,
        ticketId: c.ticketId,
        ticketTitle: c.ticket.title,
        ticketStatus: c.ticket.status,
        ticketPriority: c.ticket.priority,
        ticketCategory: c.ticket.category?.name ?? null,
        ticketSubcategory: c.ticket.subcategory?.name ?? null,
        fromStatus: null,
        toStatus: null,
        comment: c.body,
        attachments: c.attachments.map((a) => ({
          url: attachmentUrl(a.ticketId, a.id),
          originalName: a.originalName,
        })),
      })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    let user: UserActivityReport['user'] = null;
    if (userId) {
      const u = await this.prisma.user.findUnique({ where: { id: userId } });
      if (u) user = { id: u.id, name: u.name, email: u.email };
    }

    return { user, from: query.from ?? null, to: query.to ?? null, items };
  }
}
