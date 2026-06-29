import { Complexity, Priority, Role, TicketStatus } from '@chamados/shared';

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

// Cores conforme business-rules: verde, amarelo, vermelho, roxo.
export const PRIORITY_CLASS: Record<Priority, string> = {
  LOW: 'bg-green-100 text-green-800 ring-green-600/20',
  MEDIUM: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
  HIGH: 'bg-red-100 text-red-800 ring-red-600/20',
  URGENT: 'bg-purple-100 text-purple-800 ring-purple-600/20',
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  TRIAGE: 'Em triagem',
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  RESOLVED: 'Resolvido (aguardando confirmação)',
  CLOSED: 'Concluído',
};

export const STATUS_CLASS: Record<TicketStatus, string> = {
  TRIAGE: 'bg-grena/10 text-grena ring-grena/30',
  OPEN: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  RESOLVED: 'bg-green-100 text-green-800 ring-green-600/20',
  CLOSED: 'bg-gray-100 text-gray-700 ring-gray-500/20',
};

export const COMPLEXITY_LABEL: Record<Complexity, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  USER: 'Usuário',
};

// Helpers tolerantes a null (chamado em triagem ainda não tem prioridade/complexidade).
export function priorityLabel(p: Priority | null): string {
  return p ? PRIORITY_LABEL[p] : 'Em triagem';
}

export function complexityLabel(c: Complexity | null): string {
  return c ? COMPLEXITY_LABEL[c] : 'A definir';
}
