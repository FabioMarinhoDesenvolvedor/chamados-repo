import { TicketStatus } from '@chamados/shared';

const DONE: TicketStatus[] = ['RESOLVED', 'CLOSED'];

// Texto amigável para o usuário (nunca revela a prioridade/cálculo).
export function slaText(slaHours: number | null, slaDueAt: string | null): string | null {
  if (slaHours == null || !slaDueAt) return null;
  const due = new Date(slaDueAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `Prazo de atendimento: até ${slaHours} horas (até ${due})`;
}

// SLA estourado: passou do prazo e o chamado ainda não foi resolvido/concluído.
export function isSlaBreached(slaDueAt: string | null, status: TicketStatus): boolean {
  if (!slaDueAt || DONE.includes(status)) return false;
  return new Date(slaDueAt).getTime() < Date.now();
}
