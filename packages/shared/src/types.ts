import { Complexity, Priority, Role, TicketStatus } from './enums';

// Datas trafegam como string ISO no JSON da API.

export interface UserPublic {
  id: number;
  name: string;
  email: string;
  role: Role;
  departmentId: number | null;
  isKiosk: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// Primeiro acesso: usuario recem-criado define a propria senha pelo e-mail.
export interface FirstAccessInput {
  email: string;
  newPassword: string;
}

export interface Department {
  id: number;
  name: string;
  priorityWeight: number;
  isRequesterDept: boolean;
  isExecutorDept: boolean;
  requiresApproval: boolean;
  notificationEmail: string | null;
  createdAt: string;
}

// ---- Categorizacao (blocos) ----
export interface TicketCategory {
  id: number;
  slug: string;
  name: string;
  icon: string; // nome do icone lucide-react
  sortOrder: number;
  // Setor EXECUTOR dono do bloco (roteamento). Null = categoria legada sem setor.
  departmentId: number | null;
}

export interface TicketDetailOption {
  id: number;
  subcategoryId: number;
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
}

export interface TicketSubcategory {
  id: number;
  categoryId: number;
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
  // 3o nivel opcional (data-driven). Vazio = subcategoria sem detalhe.
  details?: TicketDetailOption[];
}

export interface CategoryWithSubcategories extends TicketCategory {
  subcategories: TicketSubcategory[];
}

export interface Ticket {
  id: number;
  title: string;
  description: string | null;
  categoryId: number | null;
  subcategoryId: number | null;
  // Nomes/icones da categoria embutidos para exibicao (sem N+1 - vem de um include).
  category?: TicketCategory | null;
  subcategory?: TicketSubcategory | null;
  detailOptionId: number | null;
  detailOption?: TicketDetailOption | null;
  complexity: Complexity | null;
  priority: Priority | null;
  status: TicketStatus;
  departmentId: number; // setor do SOLICITANTE (nao muda de sentido)
  executorDepartmentId: number | null; // setor EXECUTOR (destino), resolvido pela categoria
  originLocation: string | null; // capturado so via totem (Plano 4)
  requesterId: number;
  assignedTo: number | null;
  lastActivityAt: string;
  lastActivityBy: number | null;
  hasUnread?: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  rating: number | null;
  closedAt: string | null;
  slaStartedAt: string | null;
  // Primeira resposta (assumir OU ir para IN_PROGRESS). Nulo enquanto nao respondido.
  firstResponseAt: string | null;
  // Dois relogios de SLA, ambos derivados (nulos enquanto sem complexidade/inicio):
  responseSlaHours: number | null;
  responseDueAt: string | null;
  resolutionSlaHours: number | null;
  resolutionDueAt: string | null;
  // Estouro so e projetado para staff (undefined para o usuario comum).
  responseBreached?: boolean;
  resolutionBreached?: boolean;
}

export interface TicketAttachment {
  id: number;
  ticketId: number;
  commentId: number | null;
  originalName: string;
  mime: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface TicketComment {
  id: number;
  ticketId: number;
  authorId: number;
  body: string;
  createdAt: string;
  author?: UserPublic;
  attachments?: TicketAttachment[];
}

export interface TicketStatusHistory {
  id: number;
  ticketId: number;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  changedBy: number;
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  requester?: UserPublic;
  assignee?: UserPublic | null;
  department?: Department;
  executorDepartment?: Department | null;
  comments: TicketComment[];
  history: TicketStatusHistory[];
  attachments: TicketAttachment[];
}

// ---- Auth ----
export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: UserPublic;
}

export interface CreateKioskTokenInput {
  label: string;
  departmentId: number;
}

export interface KioskTokenResponse {
  token: string;
  user: UserPublic;
  expiresInDays: number;
}

// ---- Inputs ----
export interface CreateTicketInput {
  // Categorizacao guiada (substitui o titulo livre como entrada principal).
  categoryId: number;
  subcategoryId: number;
  // 3o nivel - obrigatorio quando a subcategoria escolhida tiver detalhes.
  detailOptionId?: number;
  // Descricao complementar opcional (detalhes do problema dentro da subcategoria).
  description?: string;
  departmentId: number;
  // Apenas ADMIN: abre o chamado em nome de outro usuario (solicitante).
  requesterId?: number;
  originLocation?: string;
}

export interface UpdateTicketInput {
  departmentId?: number;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  departmentId?: number | null;
  password?: string;
}

export interface UnreadCount {
  count: number;
}

export interface UpdateTicketStatusInput {
  status: TicketStatus;
}

export interface AssignTicketInput {
  assignedTo: number;
}

export interface AddCommentInput {
  body: string;
}

export interface CloseTicketInput {
  // Avaliacao opcional do solicitante (1..5 estrelas).
  rating?: number;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  departmentId?: number | null;
}

export interface CreateDepartmentInput {
  name: string;
  priorityWeight: number;
  isRequesterDept?: boolean;
  isExecutorDept?: boolean;
  requiresApproval?: boolean;
  notificationEmail?: string;
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: Priority;
  categoryId?: number;
  subcategoryId?: number;
  // 'active' = so nao-encerrados (TRIAGE/OPEN/IN_PROGRESS); ignorado se `status` vier.
  scope?: 'active' | 'all';
  // Paginacao real (1-based). Default no backend: page=1, pageSize=20.
  page?: number;
  pageSize?: number;
}

// Pagina generica de resultados (listagem nunca carrega tudo de uma vez).
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// KPIs do dashboard calculados no servidor (groupBy status), respeitando o papel.
export interface TicketStats {
  triagem: number;
  abertos: number;
  resolvidos: number;
}

// ---- Relatorios (admin) ----
export type ActivityType = 'TICKET_OPENED' | 'STATUS_CHANGED' | 'COMMENTED';

export interface ActivityAttachment {
  url: string;
  originalName: string;
}

export interface ActivityLogItem {
  at: string;
  type: ActivityType;
  actorId: number;
  actorName: string;
  ticketId: number;
  ticketTitle: string;
  // Estado atual do chamado (para a tabela de relatorio identificar por ID + status/prioridade).
  ticketStatus: TicketStatus;
  ticketPriority: Priority | null;
  ticketCategory: string | null;
  ticketSubcategory: string | null;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  comment: string | null;
  attachments: ActivityAttachment[];
}

export interface UserActivityReport {
  user: { id: number; name: string; email: string } | null; // null = todos os usuarios
  from: string | null;
  to: string | null;
  items: ActivityLogItem[];
}

export interface ReportQuery {
  userId?: number;
  from?: string;
  to?: string;
  categoryId?: number;
  subcategoryId?: number;
}

// ---- Backup (admin) ----
export interface BackupInfo {
  filename: string;
  size: number;
  createdAt: string;
}

export interface BackupList {
  directory: string;
  items: BackupInfo[];
}

export interface BackupRunResult {
  filename: string;
  size: number;
}
