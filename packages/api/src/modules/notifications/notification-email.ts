import { Priority } from '@chamados/shared';

export interface TicketEmailInput {
  ticketId: string;
  title: string;
  requesterName: string;
  requesterDepartmentName: string;
  priority: Priority | null;
  description: string | null;
  originLocation: string | null;
  createdAt: Date;
  appUrl: string | null;
}

// Monta o e-mail de aviso ao setor executor (pt-BR). Função pura — sem I/O, fácil de testar.
export function buildTicketEmail(t: TicketEmailInput): { subject: string; body: string } {
  const subject = `Novo chamado — ${t.title}`;
  const lines = [
    'Um novo chamado foi aberto para o seu setor.',
    '',
    `Título: ${t.title}`,
    `Solicitante: ${t.requesterName}`,
    `Setor do solicitante: ${t.requesterDepartmentName}`,
    `Prioridade: ${t.priority ?? '—'}`,
  ];
  if (t.description) lines.push(`Descrição: ${t.description}`);
  if (t.originLocation) lines.push(`Local de origem: ${t.originLocation}`);
  lines.push(`Aberto em: ${t.createdAt.toISOString()}`);
  if (t.appUrl) {
    lines.push('', `Abrir o chamado: ${t.appUrl.replace(/\/$/, '')}/tickets/${t.ticketId}`);
  }
  return { subject, body: lines.join('\n') };
}
