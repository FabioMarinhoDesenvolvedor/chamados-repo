import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Complexity, Priority, TicketStatus } from '@chamados/shared';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { DepartmentsRepository } from '../departments/departments.repository';
import { UsersRepository } from '../users/users.repository';
import { toUserPublic } from '../users/user.mapper';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { PriorityService } from './priority.service';
import { SlaService } from './sla.service';
import { TicketsRepository } from './tickets.repository';
import { attachmentUrl, attachmentsDir, ensureAttachmentsDir } from './attachments.config';

// Anexo cru do banco → DTO público (troca o filename físico por uma URL servível).
interface RawAttachment {
  id: string;
  ticketId: string;
  commentId: string | null;
  filename: string;
  originalName: string;
  mime: string;
  size: number;
  createdAt: Date;
}

function toAttachmentDto(a: RawAttachment) {
  return {
    id: a.id,
    ticketId: a.ticketId,
    commentId: a.commentId,
    originalName: a.originalName,
    mime: a.mime,
    size: a.size,
    url: attachmentUrl(a.ticketId, a.id),
    createdAt: a.createdAt,
  };
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly repo: TicketsRepository,
    private readonly departments: DepartmentsRepository,
    private readonly users: UsersRepository,
    private readonly priority: PriorityService,
    private readonly sla: SlaService,
  ) {}

  async create(dto: CreateTicketDto, user: AuthUser) {
    // Fonte de verdade do setor: USER abre sempre no próprio setor (sessão/banco);
    // ADMIN tem acesso total e pode escolher o setor via dto.
    let departmentId = dto.departmentId;
    // Solicitante: USER é sempre ele mesmo; ADMIN pode abrir em nome de outro usuário.
    let requesterId = user.userId;

    if (user.role === 'USER') {
      const requester = await this.users.findById(user.userId);
      if (!requester?.departmentId) {
        throw new BadRequestException('Seu usuário não tem setor; contate a TI');
      }
      departmentId = requester.departmentId;
    } else if (dto.requesterId && dto.requesterId !== user.userId) {
      const requester = await this.users.findById(dto.requesterId);
      if (!requester) throw new NotFoundException('Solicitante não encontrado');
      requesterId = requester.id;
    }

    const department = await this.departments.findById(departmentId);
    if (!department) throw new NotFoundException('Departamento não encontrado');

    return this.repo.createWithHistory({
      title: dto.title,
      description: dto.description,
      departmentId,
      requesterId,
    });
  }

  async update(id: string, dto: UpdateTicketDto, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');

    const departmentId = dto.departmentId ?? ticket.departmentId;
    const department = await this.departments.findById(departmentId);
    if (!department) throw new NotFoundException('Departamento não encontrado');

    const complexity = dto.complexity ?? ticket.complexity;
    const priority = complexity
      ? this.priority.compute(complexity, department.priorityWeight)
      : null;
    const moveToOpen = ticket.status === 'TRIAGE' && complexity != null;

    return this.repo.applyTriage({
      id,
      complexity,
      priority,
      departmentId,
      moveToOpen,
      changedBy: user.userId,
    });
  }

  async list(query: TicketQueryDto, user: AuthUser) {
    const where: Prisma.TicketWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    // Visibilidade: USER vê apenas os próprios chamados; ADMIN vê todos.
    if (user.role === 'USER') where.requesterId = user.userId;

    const tickets = await this.repo.findMany(where);
    const states = await this.repo.findReadStates(
      user.userId,
      tickets.map((t) => t.id),
    );
    const seen = new Map(states.map((s) => [s.ticketId, s.lastSeenAt]));

    return tickets.map((t) =>
      this.hideForUser(
        this.withSla({
          ...t,
          hasUnread: this.isUnread(t.lastActivityAt, t.lastActivityBy, seen.get(t.id), user.userId),
        }),
        user,
      ),
    );
  }

  async detail(id: string, user: AuthUser) {
    const ticket = await this.repo.findDetail(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket.requesterId, user);
    await this.repo.markSeen(user.userId, id);
    return this.hideForUser(
      this.withSla({
        ...ticket,
        // Mapeia relacionamentos de usuário p/ UserPublic (NUNCA expor passwordHash).
        requester: toUserPublic(ticket.requester),
        assignee: ticket.assignee ? toUserPublic(ticket.assignee) : null,
        attachments: ticket.attachments.map(toAttachmentDto),
        comments: ticket.comments.map((c) => ({
          ...c,
          author: toUserPublic(c.author),
          attachments: c.attachments.map(toAttachmentDto),
        })),
      }),
      user,
    );
  }

  async addAttachments(
    ticketId: string,
    files: Express.Multer.File[],
    commentId: string | undefined,
    user: AuthUser,
  ) {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket.requesterId, user);
    if (files.length === 0) return [];

    if (commentId) {
      const comment = await this.repo.findComment(commentId);
      if (!comment || comment.ticketId !== ticketId) {
        throw new BadRequestException('Comentário inválido para este chamado');
      }
    }

    ensureAttachmentsDir();
    const dir = attachmentsDir();
    const items = files.map((f) => {
      const filename = randomUUID();
      // Grava o arquivo como está (sem criptografia). Acesso é protegido pelo endpoint.
      writeFileSync(join(dir, filename), f.buffer);
      return { filename, originalName: f.originalname, mime: f.mimetype, size: f.size };
    });

    const created = await this.repo.createAttachments(ticketId, commentId ?? null, items);
    return created.map(toAttachmentDto);
  }

  // Lê o anexo do disco externo e devolve o conteúdo (acesso protegido por ensureCanView).
  async getAttachmentFile(ticketId: string, attachmentId: string, user: AuthUser) {
    const attachment = await this.repo.findAttachment(attachmentId);
    if (!attachment || attachment.ticketId !== ticketId) {
      throw new NotFoundException('Anexo não encontrado');
    }
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket.requesterId, user);

    const path = join(attachmentsDir(), attachment.filename);
    if (!existsSync(path)) throw new NotFoundException('Arquivo do anexo não encontrado');
    const data = readFileSync(path);
    return { data, mime: attachment.mime, originalName: attachment.originalName };
  }

  async unreadCount(user: AuthUser) {
    const tickets = await this.list({} as TicketQueryDto, user);
    return { count: tickets.filter((t) => t.hasUnread).length };
  }

  async updateStatus(id: string, status: TicketStatus, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');

    const resolvedAt =
      status === 'RESOLVED' ? new Date() : status === 'CLOSED' ? ticket.resolvedAt : null;

    return this.repo.updateStatusWithHistory({
      id,
      fromStatus: ticket.status,
      toStatus: status,
      changedBy: user.userId,
      resolvedAt,
    });
  }

  // Encerramento pelo solicitante (ou admin): só a partir de RESOLVED.
  async close(id: string, rating: number | undefined, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket.requesterId, user);
    if (ticket.status !== 'RESOLVED') {
      throw new BadRequestException(
        'Só é possível concluir um chamado já resolvido pela TI',
      );
    }
    return this.repo.closeWithRating({
      id,
      fromStatus: ticket.status,
      changedBy: user.userId,
      rating: rating ?? null,
    });
  }

  async assign(id: string, assignedTo: string) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');

    const assignee = await this.users.findById(assignedTo);
    if (!assignee) throw new NotFoundException('Usuário atribuído não encontrado');
    // Regra de negócio: assigned_to deve ser sempre um admin.
    if (assignee.role !== 'ADMIN') {
      throw new BadRequestException('Apenas administradores podem ser responsáveis por um chamado');
    }
    return this.repo.assign(id, assignedTo);
  }

  async addComment(id: string, body: string, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket.requesterId, user);
    // Chamado concluído: o usuário comum não pode mais comentar (admin tem acesso total).
    if (user.role === 'USER' && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')) {
      throw new ForbiddenException('Este chamado foi concluído. Não é possível adicionar comentários.');
    }
    const comment = await this.repo.addComment(id, user.userId, body);
    // NUNCA expor passwordHash do autor no retorno do comentário.
    return { ...comment, author: toUserPublic(comment.author) };
  }

  // Anexa o prazo de SLA derivado (nulo enquanto em triagem / sem prioridade).
  private withSla<T extends { priority: Priority | null; slaStartedAt: Date | null }>(
    t: T,
  ): T & { slaHours: number | null; slaDueAt: Date | null } {
    if (!t.priority || !t.slaStartedAt) {
      return { ...t, slaHours: null, slaDueAt: null };
    }
    return {
      ...t,
      slaHours: this.sla.hours(t.priority),
      slaDueAt: this.sla.dueAt(t.priority, t.slaStartedAt),
    };
  }

  // Esconde do USER os campos de cálculo (prioridade/complexidade) e a nota.
  // SLA derivado (slaHours/slaDueAt) é mantido — é o que o usuário pode ver.
  private hideForUser<
    T extends { priority: Priority | null; complexity: Complexity | null; rating: number | null },
  >(t: T, user: AuthUser): T {
    if (user.role !== 'USER') return t;
    return { ...t, priority: null, complexity: null, rating: null };
  }

  private isUnread(
    lastActivityAt: Date,
    lastActivityBy: string | null,
    lastSeenAt: Date | undefined,
    userId: string,
  ): boolean {
    if (!lastActivityBy || lastActivityBy === userId) return false;
    if (!lastSeenAt) return true;
    return lastActivityAt > lastSeenAt;
  }

  private ensureCanView(requesterId: string, user: AuthUser): void {
    if (user.role === 'ADMIN') return;
    if (requesterId !== user.userId) {
      throw new ForbiddenException('Você não tem acesso a este chamado');
    }
  }
}
