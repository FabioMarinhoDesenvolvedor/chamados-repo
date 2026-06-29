import { TicketStatus } from '@chamados/shared';

const DONE: TicketStatus[] = ['RESOLVED', 'CLOSED'];

// Texto amigável para o usuário (nunca revela a prioridade/cálculo).
export function slaText(slaHours: number | null): string | null {
  if (slaHours == null) return null;
  return `Prazo de atendimento: até ${slaHours} horas`;
}

// SLA estourado: passou do prazo e o chamado ainda não foi resolvido/concluído.
export function isSlaBreached(slaDueAt: string | null, status: TicketStatus): boolean {
  if (!slaDueAt || DONE.includes(status)) return false;
  return new Date(slaDueAt).getTime() < Date.now();
}
