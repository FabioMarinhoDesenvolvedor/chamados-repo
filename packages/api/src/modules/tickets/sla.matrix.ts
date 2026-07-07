import { Complexity } from '@chamados/shared';
import { WeightBand, weightBand } from './priority.matrix';

// Dois relógios de SLA, ambos automáticos e granulares (complexidade × faixa-de-peso).
// Aprovado por Fabio em 2026-07-07 (spec sla-automatico-dois-tempos). Horas corridas 24/7,
// inteiras. Monótonas (mais complexo e/ou setor mais pesado => prazo menor). Fonte única de
// verdade (DRY): NUNCA calcular no banco. Trocar números aqui não exige migração de dado.

// Tempo de CONCLUSÃO (resolver).
const RESOLUTION_HOURS: Record<Complexity, Record<WeightBand, number>> = {
  LOW: { BAIXO: 48, MEDIO: 40, ALTO: 24 },
  MEDIUM: { BAIXO: 24, MEDIO: 16, ALTO: 8 },
  HIGH: { BAIXO: 8, MEDIO: 4, ALTO: 2 },
  CRITICAL: { BAIXO: 4, MEDIO: 2, ALTO: 1 },
};

// Tempo de RESPOSTA (ver e responder). Resposta <= conclusão em toda célula.
const RESPONSE_HOURS: Record<Complexity, Record<WeightBand, number>> = {
  LOW: { BAIXO: 8, MEDIO: 6, ALTO: 4 },
  MEDIUM: { BAIXO: 4, MEDIO: 3, ALTO: 2 },
  HIGH: { BAIXO: 2, MEDIO: 1, ALTO: 1 },
  CRITICAL: { BAIXO: 1, MEDIO: 1, ALTO: 1 },
};

export function responseHours(complexity: Complexity, priorityWeight: number): number {
  return RESPONSE_HOURS[complexity][weightBand(priorityWeight)];
}

export function resolutionHours(complexity: Complexity, priorityWeight: number): number {
  return RESOLUTION_HOURS[complexity][weightBand(priorityWeight)];
}
