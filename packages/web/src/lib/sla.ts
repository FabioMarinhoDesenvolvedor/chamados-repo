import { Ticket, TicketStatus } from '@chamados/shared';

const DONE: TicketStatus[] = ['RESOLVED', 'CLOSED'];

// Texto amigável ao usuário (nunca revela prioridade/complexidade).
export function responseText(t: Pick<Ticket, 'responseSlaHours'>): string | null {
  if (t.responseSlaHours == null) return null;
  return `Resposta em até ${t.responseSlaHours}h`;
}

export function resolutionText(t: Pick<Ticket, 'resolutionSlaHours'>): string | null {
  if (t.resolutionSlaHours == null) return null;
  return `Conclusão em até ${t.resolutionSlaHours}h`;
}

// "Respondido" quando a 1ª resposta já foi registrada.
export function isResponded(t: Pick<Ticket, 'firstResponseAt'>): boolean {
  return t.firstResponseAt != null;
}

// Breach vem do backend (só staff o recebe); esconde em chamado encerrado.
export function responseBreached(t: Pick<Ticket, 'responseBreached' | 'status'>): boolean {
  return !!t.responseBreached && !DONE.includes(t.status);
}
export function resolutionBreached(t: Pick<Ticket, 'resolutionBreached' | 'status'>): boolean {
  return !!t.resolutionBreached && !DONE.includes(t.status);
}
