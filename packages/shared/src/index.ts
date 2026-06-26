// Re-exports nomeados explícitos (evita `export *`, que em CommonJS vira
// __exportStar dinâmico e não é analisável estaticamente pelo Rollup/Vite).

export { ROLES, COMPLEXITIES, PRIORITIES, TICKET_STATUSES } from './enums';
export type { Role, Complexity, Priority, TicketStatus } from './enums';

export type {
  UserPublic,
  Department,
  Ticket,
  TicketComment,
  TicketAttachment,
  TicketStatusHistory,
  TicketDetail,
  LoginInput,
  AuthResponse,
  ChangePasswordInput,
  FirstAccessInput,
  CreateTicketInput,
  UpdateTicketInput,
  UpdateTicketStatusInput,
  AssignTicketInput,
  AddCommentInput,
  CreateUserInput,
  UpdateUserInput,
  CreateDepartmentInput,
  TicketFilters,
  UnreadCount,
  ActivityType,
  ActivityAttachment,
  ActivityLogItem,
  UserActivityReport,
  ReportQuery,
  BackupInfo,
  BackupList,
  BackupRunResult,
} from './types';
