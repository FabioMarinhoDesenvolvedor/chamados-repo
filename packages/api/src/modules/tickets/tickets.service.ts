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
import { Complexity, Priority, TicketStats, TicketStatus, isStaffRole } from '@chamados/shared';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { DepartmentsRepository } from '../departments/departments.repository';
import { CategoriesRepository } from '../categories/categories.repository';
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
    private readonly categories: CategoriesRepository,
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

    // Categorização guiada: valida que a subcategoria pertence à categoria informada
    // e deriva o "Assunto" (título) a partir dos rótulos — sem texto livre obrigatório.
    const subcategory = await this.categories.findSubcategory(dto.subcategoryId);
    if (!subcategory || subcategory.categoryId !== dto.categoryId) {
      throw new BadRequestException('Subcategoria inválida para a categoria informada');
    }
    const title = `${subcategory.category.name} › ${subcategory.name}`;

    return this.repo.createWithHistory({
      title,
      description: dto.description ?? null,
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId,
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

    const updated = await this.repo.applyTriage({
      id,
      complexity,
      priority,
      departmentId,
      moveToOpen,
      changedBy: user.userId,
    });
    // Retorna já projetado (prioridade recalculada + SLA derivado + projeção por papel),
    // para o front aplicar a resposta direto no cache e o badge refletir na hora.
    return this.hideByRole(this.withSla(updated), user);
  }

  // Filtro de listagem compartilhado por list() e stats(), com visibilidade por papel.
  private listWhere(query: TicketQueryDto, user: AuthUser): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};
    if (query.status) where.status = query.status;
    // "Em aberto": esconde resolvidos/concluídos quando não há status específico.
    else if (query.scope === 'active') where.status = { notIn: ['RESOLVED', 'CLOSED'] };
    if (query.priority) where.priority = query.priority;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.subcategoryId) where.subcategoryId = query.subcategoryId;
    // Visibilidade: USER vê apenas os próprios chamados; staff (ADMIN/OPERATOR) vê todos.
    if (user.role === 'USER') where.requesterId = user.userId;
    return where;
  }

  // Listagem PAGINADA (nunca carrega tudo). Retorna { items, total, page, pageSize }.
  async list(query: TicketQueryDto, user: AuthUser) {
    const where = this.listWhere(query, user);
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;

    const [rows, total] = await Promise.all([
      this.repo.findManyPaginated(where, (page - 1) * pageSize, pageSize),
      this.repo.count(where),
    ]);

    const states = await this.repo.findReadStates(
      user.userId,
      rows.map((t) => t.id),
    );
    const seen = new Map(states.map((s) => [s.ticketId, s.lastSeenAt]));

    const items = rows.map((t) =>
      this.hideByRole(
        this.withSla({
          ...t,
          hasUnread: this.isUnread(t.lastActivityAt, t.lastActivityBy, seen.get(t.id), user.userId),
        }),
        user,
      ),
    );

    return { items, total, page, pageSize };
  }

  // KPIs do dashboard calculados no servidor (groupBy status), respeitando o papel.
  async stats(user: AuthUser): Promise<TicketStats> {
    const where: Prisma.TicketWhereInput =
      user.role === 'USER' ? { requesterId: user.userId } : {};
    const grouped = await this.repo.groupByStatus(where);
    const count = (s: TicketStatus) =>
      grouped.find((g) => g.status === s)?._count._all ?? 0;
    return {
      triagem: count('TRIAGE'),
      abertos: count('OPEN') + count('IN_PROGRESS'),
      resolvidos: count('RESOLVED') + count('CLOSED'),
    };
  }

  async detail(id: string, user: AuthUser) {
    const ticket = await this.repo.findDetail(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket.requesterId, user);
    await this.repo.markSeen(user.userId, id);
    return this.hideByRole(
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
    const count = await this.repo.countUnread(user.userId, user.role === 'USER');
    return { count };
  }

  async updateStatus(id: string, status: TicketStatus, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');

    const resolvedAt =
      status === 'RESOLVED' ? new Date() : status === 'CLOSED' ? ticket.resolvedAt : null;

    const updated = await this.repo.updateStatusWithHistory({
      id,
      fromStatus: ticket.status,
      toStatus: status,
      changedBy: user.userId,
      resolvedAt,
    });
    return this.hideByRole(this.withSla(updated), user);
  }

  // Encerramento pelo solicitante (ou admin): só a partir de RESOLVED.
  // OPERATOR resolve o chamado, mas a confirmação/conclusão é do solicitante ou do ADMIN.
  async close(id: string, rating: number | undefined, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    if (user.role !== 'ADMIN' && ticket.requesterId !== user.userId) {
      throw new ForbiddenException('Apenas o solicitante ou um administrador pode concluir o chamado');
    }
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

  async assign(id: string, assignedTo: string, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');

    // OPERATOR só pode assumir o chamado para si; ADMIN atribui a qualquer membro da equipe.
    if (user.role === 'OPERATOR' && assignedTo !== user.userId) {
      throw new ForbiddenException('Operador só pode assumir chamados para si mesmo');
    }

    const assignee = await this.users.findById(assignedTo);
    if (!assignee) throw new NotFoundException('Usuário atribuído não encontrado');
    // Regra de negócio: o responsável deve ser da equipe de atendimento (ADMIN ou OPERATOR).
    if (!isStaffRole(assignee.role)) {
      throw new BadRequestException(
        'Apenas administradores ou operadores podem ser responsáveis por um chamado',
      );
    }
    return this.repo.assign(id, assignedTo);
  }

  async addComment(id: string, body: string, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket.requesterId, user);
    // Chamado resolvido/concluído: ninguém comenta (nem admin). Para retomar, a equipe
    // volta o status para "em andamento" (reabre) antes de comentar.
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      throw new ForbiddenException(
        'Este chamado está resolvido/concluído. Não é possível adicionar comentários.',
      );
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

  // Projeção por papel:
  // - USER: esconde prioridade/complexidade (cálculo interno) e a nota.
  // - OPERATOR: vê prioridade/complexidade (precisa para atender), mas NÃO a nota
  //   (avaliação é visível só ao admin — business-rules).
  // - ADMIN: vê tudo.
  // SLA derivado (slaHours/slaDueAt) é sempre mantido.
  private hideByRole<
    T extends { priority: Priority | null; complexity: Complexity | null; rating: number | null },
  >(t: T, user: AuthUser): T {
    if (user.role === 'USER') return { ...t, priority: null, complexity: null, rating: null };
    if (user.role === 'OPERATOR') return { ...t, rating: null };
    return t;
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
    // Staff (ADMIN/OPERATOR) vê todos os chamados; USER só os próprios.
    if (isStaffRole(user.role)) return;
    if (requesterId !== user.userId) {
      throw new ForbiddenException('Você não tem acesso a este chamado');
    }
  }
}
