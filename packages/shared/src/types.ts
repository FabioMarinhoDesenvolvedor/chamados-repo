import { Complexity, Priority, Role, TicketStatus } from './enums';

// Datas trafegam como string ISO no JSON da API.

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// Primeiro acesso: usuário recém-criado define a própria senha pelo e-mail.
export interface FirstAccessInput {
  email: string;
  newPassword: string;
}

export interface Department {
  id: string;
  name: string;
  priorityWeight: number;
  createdAt: string;
}

// ---- Categorização (blocos) ----
export interface TicketCategory {
  id: string;
  slug: string;
  name: string;
  icon: string; // nome do ícone lucide-react
  sortOrder: number;
}

export interface TicketSubcategory {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
}

export interface CategoryWithSubcategories extends TicketCategory {
  subcategories: TicketSubcategory[];
}

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  // Nomes/ícones da categoria embutidos para exibição (sem N+1 — vêm de um include).
  category?: TicketCategory | null;
  subcategory?: TicketSubcategory | null;
  complexity: Complexity | null;
  priority: Priority | null;
  status: TicketStatus;
  departmentId: string;
  requesterId: string;
  assignedTo: string | null;
  lastActivityAt: string;
  lastActivityBy: string | null;
  hasUnread?: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  rating: number | null;
  closedAt: string | null;
  slaStartedAt: string | null;
  // Derivados (calculados no backend; nulos enquanto em triagem):
  slaHours: number | null;
  slaDueAt: string | null;
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  commentId: string | null;
  originalName: string;
  mime: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author?: UserPublic;
  attachments?: TicketAttachment[];
}

export interface TicketStatusHistory {
  id: string;
  ticketId: string;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  changedBy: string;
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  requester?: UserPublic;
  assignee?: UserPublic | null;
  department?: Department;
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

// ---- Inputs ----
export interface CreateTicketInput {
  // Categorização guiada (substitui o título livre como entrada principal).
  categoryId: string;
  subcategoryId: string;
  // Descrição complementar opcional (detalhes do problema dentro da subcategoria).
  description?: string;
  departmentId: string;
  // Apenas ADMIN: abre o chamado em nome de outro usuário (solicitante).
  requesterId?: string;
}

export interface UpdateTicketInput {
  complexity?: Complexity;
  departmentId?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  departmentId?: string | null;
  password?: string;
}

export interface UnreadCount {
  count: number;
}

export interface UpdateTicketStatusInput {
  status: TicketStatus;
}

export interface AssignTicketInput {
  assignedTo: string;
}

export interface AddCommentInput {
  body: string;
}

export interface CloseTicketInput {
  // Avaliação opcional do solicitante (1..5 estrelas).
  rating?: number;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  departmentId?: string | null;
}

export interface CreateDepartmentInput {
  name: string;
  priorityWeight: number;
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: Priority;
  categoryId?: string;
  subcategoryId?: string;
  // 'active' = só não-encerrados (TRIAGE/OPEN/IN_PROGRESS); ignorado se `status` vier.
  scope?: 'active' | 'all';
  // Paginação real (1-based). Default no backend: page=1, pageSize=20.
  page?: number;
  pageSize?: number;
}

// Página genérica de resultados (listagem nunca carrega tudo de uma vez).
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

// ---- Relatórios (admin) ----
export type ActivityType = 'TICKET_OPENED' | 'STATUS_CHANGED' | 'COMMENTED';

export interface ActivityAttachment {
  url: string;
  originalName: string;
}

export interface ActivityLogItem {
  at: string;
  type: ActivityType;
  actorId: string;
  actorName: string;
  ticketId: string;
  ticketTitle: string;
  // Estado atual do chamado (para a tabela de relatório identificar por ID + status/prioridade).
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
  user: { id: string; name: string; email: string } | null; // null = todos os usuários
  from: string | null;
  to: string | null;
  items: ActivityLogItem[];
}

export interface ReportQuery {
  userId?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  subcategoryId?: string;
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
