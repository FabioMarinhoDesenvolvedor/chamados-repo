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

export interface Ticket {
  id: string;
  title: string;
  description: string;
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
  title: string;
  description: string;
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
