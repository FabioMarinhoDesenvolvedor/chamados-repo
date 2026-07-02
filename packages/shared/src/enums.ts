// Enums de domínio (PascalCase para o tipo, valores UPPER_SNAKE_CASE).
// Definidos como union types + arrays const para uso runtime (validação) e estático.
// Valores idênticos aos enums do Prisma => interoperáveis sem cast entre API e shared.

export const ROLES = ['ADMIN', 'USER', 'OPERATOR'] as const;
export type Role = (typeof ROLES)[number];

export const COMPLEXITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Complexity = (typeof COMPLEXITIES)[number];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TICKET_STATUSES = [
  'TRIAGE',
  'PENDING_APPROVAL',
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
