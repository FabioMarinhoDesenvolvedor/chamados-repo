import { Priority } from '@chamados/shared';

// Prazo de atendimento por prioridade, em horas corridas (24/7).
// Aprovado em 2026-06-29. Fonte única de verdade (DRY): nunca calcular no banco.
const SLA_HOURS: Record<Priority, number> = {
  LOW: 24,
  MEDIUM: 24,
  HIGH: 3,
  URGENT: 1,
};

export function slaHours(priority: Priority): number {
  return SLA_HOURS[priority];
}
