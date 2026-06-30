// Re-exports nomeados explícitos (evita `export *`, que em CommonJS vira
// __exportStar dinâmico e não é analisável estaticamente pelo Rollup/Vite).

export { ROLES, COMPLEXITIES, PRIORITIES, TICKET_STATUSES } from './enums';
export type { Role, Complexity, Priority, TicketStatus } from './enums';

export { isStaffRole } from './roles';

export {
  PASSWORD_MIN_LENGTH,
  STRONG_PASSWORD_REGEX,
  PASSWORD_RULE_MESSAGE,
  TEMP_PASSWORD_MIN_LENGTH,
  isStrongPassword,
} from './password';

export type {
  UserPublic,
  Department,
  TicketCategory,
  TicketSubcategory,
  CategoryWithSubcategories,
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
  CloseTicketInput,
  CreateUserInput,
  UpdateUserInput,
  CreateDepartmentInput,
  TicketFilters,
  Paginated,
  TicketStats,
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
