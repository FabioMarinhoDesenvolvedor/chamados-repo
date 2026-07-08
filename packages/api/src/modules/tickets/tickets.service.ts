import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { buildTicketEmail } from '../notifications/notification-email';

// Anexo cru do banco → DTO público (troca o filename físico por uma URL servível).
interface RawAttachment {
  id: number;
  ticketId: number;
  commentId: number | null;
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
    private readonly config: ConfigService,
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

    // Categorização guiada: valida que a subcategoria pertence à categoria e deriva o
    // "Assunto" (título). O 3º nível ("detalhe") é obrigatório quando a subcategoria tiver
    // detalhes, e proibido quando não tiver — mantém o dado consistente.
    const subcategory = await this.categories.findSubcategory(dto.subcategoryId);
    if (!subcategory || subcategory.categoryId !== dto.categoryId) {
      throw new BadRequestException('Subcategoria inválida para a categoria informada');
    }

    // O 3º nível ("detalhe") é OPCIONAL — a abertura não pode travar quem não sabe o detalhe.
    // Se informado, precisa pertencer à subcategoria; se ausente, o chamado segue sem detalhe.
    const details = subcategory.details ?? [];
    let detailOptionId: number | null = null;
    let detailName: string | null = null;
    if (dto.detailOptionId) {
      const detail = details.find((d) => d.id === dto.detailOptionId);
      if (!detail) {
        throw new BadRequestException('Detalhe inválido para a subcategoria informada');
      }
      detailOptionId = detail.id;
      detailName = detail.name;
    }

    const title = detailName
      ? `${subcategory.category.name} › ${subcategory.name} › ${detailName}`
      : `${subcategory.category.name} › ${subcategory.name}`;

    // Roteamento: setor EXECUTOR vem da categoria (não do departamento do solicitante).
    // Categoria sem setor mapeado é erro de dado (não deveria acontecer via UI guiada).
    const executorDepartmentId = subcategory.category.departmentId;
    if (!executorDepartmentId) {
      throw new BadRequestException('Categoria sem setor executor configurado');
    }
    const executorDepartment = await this.departments.findById(executorDepartmentId);
    if (!executorDepartment) throw new NotFoundException('Setor executor não encontrado');

    // Prioridade/SLA automáticos na abertura: a complexidade-base vem da categorização
    // (detalhe > subcategoria > MÉDIA como padrão) e a prioridade é derivada pela matriz
    // com o peso do setor. O chamado NASCE priorizado — sem depender de triagem manual,
    // mesmo quando o setor exige aprovação (aprovação não represa o SLA — decisão aprovada).
    const detail = detailOptionId ? details.find((d) => d.id === detailOptionId) : null;
    const complexity: Complexity =
      detail?.baseComplexity ?? subcategory.baseComplexity ?? 'MEDIUM';
    const priority = this.priority.compute(complexity, department.priorityWeight);
    // Aprovação removida (spec sla-dois-tempos-automatico): todo chamado nasce OPEN.
    const status: TicketStatus = 'OPEN';

    // originLocation: só de solicitante kiosk (totem). Usuário comum não define origem.
    let originLocation: string | null = null;
    if (user.isKiosk) {
      const loc = dto.originLocation?.trim();
      if (!loc) throw new BadRequestException('Informe o local/sala de origem');
      originLocation = loc;
    }

    // Padrão outbox: o id é gerado aqui para montar o link do e-mail ANTES do insert e
    // enfileirar a notificação na MESMA transação do chamado (createWithHistory).
    let notification:
      | {
          toEmail: string;
          emailInput: Omit<Parameters<typeof buildTicketEmail>[0], 'ticketId'>;
        }
      | undefined;
    if (executorDepartment.notificationEmail) {
      const requesterUser = await this.users.findById(requesterId);
      notification = {
        toEmail: executorDepartment.notificationEmail,
        emailInput: {
          title,
          requesterName: requesterUser?.name ?? String(requesterId),
          requesterDepartmentName: department.name,
          priority,
          description: dto.description ?? null,
          originLocation,
          createdAt: new Date(),
          appUrl: this.config.get<string>('APP_URL') ?? null,
        },
      };
    }

    const created = await this.repo.createWithHistory({
      title,
      description: dto.description ?? null,
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId,
      detailOptionId,
      complexity,
      priority,
      status,
      departmentId,
      executorDepartmentId,
      requesterId,
      originLocation,
      notification,
    });
    // Retorna já projetado (SLA derivado + projeção por papel), como update()/updateStatus(),
    // para o "Prazo" já vir preenchido na resposta da criação.
    return this.hideByRole(this.withSla(created), user);
  }

  async update(id: number, dto: UpdateTicketDto, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');

    const departmentId = dto.departmentId ?? ticket.departmentId;
    const department = await this.departments.findById(departmentId);
    if (!department) throw new NotFoundException('Departamento não encontrado');

    const complexity = ticket.complexity;
    const priority = complexity
      ? this.priority.compute(complexity, department.priorityWeight)
      : null;
    const updated = await this.repo.applyTriage({
      id,
      complexity,
      priority,
      departmentId,
      moveToOpen: false,
      changedBy: user.userId,
    });
    // Retorna já projetado (prioridade recalculada + SLA derivado + projeção por papel),
    // para o front aplicar a resposta direto no cache e o badge refletir na hora.
    return this.hideByRole(this.withSla(updated), user);
  }

  // Filtro de listagem compartilhado por list() e stats(), com visibilidade por papel.
  private listWhere(query: TicketQueryDto, user: AuthUser): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};
    // OPERATOR com setor definido só vê/atende o próprio setor executor; ADMIN NUNCA é
    // restrito (mesmo com departmentId setado); OPERATOR sem departmentId vê tudo (regressão).
    const isOperatorScoped = user.role === 'OPERATOR' && !!user.departmentId;

    if (query.status) {
      where.status = query.status;
    } else {
      const hidden: TicketStatus[] = [];
      // "Em aberto": esconde resolvidos/concluídos quando não há status específico.
      if (query.scope === 'active') hidden.push('RESOLVED', 'CLOSED');
      // Valor legado dormente: não aparece na fila de atendimento do setor.
      if (isOperatorScoped) hidden.push('PENDING_APPROVAL');
      if (hidden.length) where.status = { notIn: hidden };
    }
    if (query.priority) where.priority = query.priority;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.subcategoryId) where.subcategoryId = query.subcategoryId;

    // Visibilidade: USER vê apenas os próprios chamados; OPERATOR escopado vê só o
    // próprio setor executor; ADMIN e OPERATOR sem setor veem tudo (comportamento atual).
    if (user.role === 'USER') where.requesterId = user.userId;
    else if (isOperatorScoped) where.executorDepartmentId = user.departmentId;

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
      user.role === 'USER'
        ? { requesterId: user.userId }
        : user.role === 'OPERATOR' && user.departmentId
          ? { executorDepartmentId: user.departmentId }
          : {};
    const grouped = await this.repo.groupByStatus(where);
    const count = (s: TicketStatus) =>
      grouped.find((g) => g.status === s)?._count._all ?? 0;
    return {
      triagem: count('TRIAGE'),
      abertos: count('OPEN') + count('IN_PROGRESS'),
      resolvidos: count('RESOLVED') + count('CLOSED'),
    };
  }

  async detail(id: number, user: AuthUser) {
    const ticket = await this.repo.findDetail(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket, user);
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
    ticketId: number,
    files: Express.Multer.File[],
    commentId: number | undefined,
    user: AuthUser,
  ) {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket, user);
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
  async getAttachmentFile(ticketId: number, attachmentId: number, user: AuthUser) {
    const attachment = await this.repo.findAttachment(attachmentId);
    if (!attachment || attachment.ticketId !== ticketId) {
      throw new NotFoundException('Anexo não encontrado');
    }
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket, user);

    const path = join(attachmentsDir(), attachment.filename);
    if (!existsSync(path)) throw new NotFoundException('Arquivo do anexo não encontrado');
    const data = readFileSync(path);
    return { data, mime: attachment.mime, originalName: attachment.originalName };
  }

  async unreadCount(user: AuthUser) {
    // Não-lidos respeitam a mesma visibilidade da listagem: USER só os próprios; OPERATOR
    // escopado só o próprio setor executor; ADMIN e OPERATOR global (sem setor) veem tudo.
    const scope =
      user.role === 'USER'
        ? { onlyOwn: true }
        : user.role === 'OPERATOR' && user.departmentId
          ? { onlyOwn: false, executorDepartmentId: user.departmentId }
          : { onlyOwn: false };
    const count = await this.repo.countUnread(user.userId, scope);
    return { count };
  }

  async updateStatus(id: number, status: TicketStatus, user: AuthUser) {
    if (status === 'PENDING_APPROVAL') {
      throw new BadRequestException(
        'Não é possível definir "aguardando aprovação" manualmente — use o endpoint de aprovação',
      );
    }
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket, user);

    // Valor legado dormente: se ainda existir no banco, precisa ser saneado antes de mudar
    // o status manualmente.
    if (ticket.status === 'PENDING_APPROVAL') {
      throw new BadRequestException(
        'Chamado aguardando aprovação — use o endpoint de aprovação (não é possível mudar o status manualmente)',
      );
    }

    const resolvedAt =
      status === 'RESOLVED' ? new Date() : status === 'CLOSED' ? ticket.resolvedAt : null;
    // Primeira resposta: ir para IN_PROGRESS marca first_response_at se ainda não houver.
    const firstResponseAt =
      status === 'IN_PROGRESS' && ticket.firstResponseAt == null ? new Date() : undefined;

    const updated = await this.repo.updateStatusWithHistory({
      id,
      fromStatus: ticket.status,
      toStatus: status,
      changedBy: user.userId,
      resolvedAt,
      firstResponseAt,
    });
    return this.hideByRole(this.withSla(updated), user);
  }

  // Conclusão/avaliação pelo solicitante (ou admin):
  // - RESOLVED: confirma a conclusão (vai para CLOSED) com avaliação opcional — fluxo normal.
  // - CLOSED sem nota: chamado encerrado direto pelo admin; o solicitante ainda pode avaliar
  //   UMA vez (a nota exige valor, aqui não há conclusão a fazer — só registrar a avaliação).
  // OPERATOR resolve o chamado, mas a confirmação/avaliação é do solicitante ou do ADMIN.
  async close(id: number, rating: number | undefined, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    if (user.role !== 'ADMIN' && ticket.requesterId !== user.userId) {
      throw new ForbiddenException('Apenas o solicitante ou um administrador pode concluir o chamado');
    }
    if (ticket.status === 'RESOLVED') {
      return this.repo.closeWithRating({
        id,
        fromStatus: ticket.status,
        changedBy: user.userId,
        rating: rating ?? null,
      });
    }
    if (ticket.status === 'CLOSED') {
      if (ticket.rating != null) {
        throw new BadRequestException('Este chamado já foi avaliado.');
      }
      if (rating == null) {
        throw new BadRequestException('Informe uma avaliação de 1 a 5 estrelas.');
      }
      return this.repo.setRating(id, rating);
    }
    throw new BadRequestException('Só é possível avaliar/concluir um chamado já resolvido pela TI.');
  }

  async assign(id: number, assignedTo: number, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket, user);

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
    // Primeira resposta: assumir marca first_response_at se ainda não houver.
    return this.repo.assign(id, assignedTo, ticket.firstResponseAt == null);
  }

  async addComment(id: number, body: string, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket, user);
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

  // Anexa os dois prazos derivados (nulos sem complexidade-base/início/peso) + estouro.
  // Estouro é computado sempre; hideByRole remove do USER.
  private withSla<
    T extends {
      complexity: Complexity | null;
      slaStartedAt: Date | null;
      firstResponseAt: Date | null;
      resolvedAt: Date | null;
      department?: { priorityWeight: number } | null;
    },
  >(t: T) {
    const weight = t.department?.priorityWeight;
    if (t.slaStartedAt == null || weight == null) {
      return {
        ...t,
        responseSlaHours: null, responseDueAt: null,
        resolutionSlaHours: null, resolutionDueAt: null,
        responseBreached: false, resolutionBreached: false,
      };
    }
    const responseDueAt = this.sla.responseDueAt(t.complexity, weight, t.slaStartedAt);
    const resolutionDueAt = this.sla.resolutionDueAt(t.complexity, weight, t.slaStartedAt);
    const now = Date.now();
    const responseBreached =
      t.firstResponseAt == null ? now > responseDueAt.getTime() : t.firstResponseAt > responseDueAt;
    const resolutionBreached =
      t.resolvedAt == null ? now > resolutionDueAt.getTime() : t.resolvedAt > resolutionDueAt;
    return {
      ...t,
      responseSlaHours: this.sla.responseHours(t.complexity, weight),
      responseDueAt,
      resolutionSlaHours: this.sla.resolutionHours(t.complexity, weight),
      resolutionDueAt,
      responseBreached,
      resolutionBreached,
    };
  }

  // Projeção por papel:
  // - USER: esconde prioridade/complexidade (cálculo interno), a nota e o estouro de SLA
  //   (os prazos em si continuam visíveis — só o "estourou ou não" é interno).
  // - OPERATOR: vê prioridade/complexidade (precisa para atender), mas NÃO a nota
  //   (avaliação é visível só ao admin — business-rules).
  // - ADMIN: vê tudo.
  private hideByRole<
    T extends {
      priority: Priority | null;
      complexity: Complexity | null;
      rating: number | null;
      responseBreached?: boolean;
      resolutionBreached?: boolean;
    },
  >(t: T, user: AuthUser): T & { rated: boolean } {
    // `rated` é derivado (só booleano, nunca a nota) e sobrevive à ocultação: o solicitante
    // precisa saber se já avaliou, sem ver a nota (que segue restrita ao admin).
    const rated = t.rating != null;
    if (user.role === 'USER') {
      return { ...t, rated, priority: null, complexity: null, rating: null, responseBreached: undefined, resolutionBreached: undefined };
    }
    if (user.role === 'OPERATOR') return { ...t, rated, rating: null };
    return { ...t, rated };
  }

  private isUnread(
    lastActivityAt: Date,
    lastActivityBy: number | null,
    lastSeenAt: Date | undefined,
    userId: number,
  ): boolean {
    if (!lastActivityBy || lastActivityBy === userId) return false;
    if (!lastSeenAt) return true;
    return lastActivityAt > lastSeenAt;
  }

  private ensureCanView(
    ticket: { requesterId: number; executorDepartmentId: number | null },
    user: AuthUser,
  ): void {
    if (user.role === 'ADMIN') return; // ADMIN nunca é restrito.
    if (user.role === 'OPERATOR') {
      // OPERATOR sem setor definido mantém o comportamento atual (vê tudo).
      if (user.departmentId && ticket.executorDepartmentId !== user.departmentId) {
        throw new ForbiddenException('Você não tem acesso a chamados de outro setor');
      }
      return;
    }
    if (ticket.requesterId !== user.userId) {
      throw new ForbiddenException('Você não tem acesso a este chamado');
    }
  }
}
