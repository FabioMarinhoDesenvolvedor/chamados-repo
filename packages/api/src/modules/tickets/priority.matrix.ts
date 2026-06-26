import { Complexity, Priority } from '@chamados/shared';

// Faixas de priority_weight do departamento (ver docs/memory/architecture/business-rules.md):
// Baixo = 1-2 | Médio = 3 | Alto = 4-5
type WeightBand = 'BAIXO' | 'MEDIO' | 'ALTO';

export function weightBand(priorityWeight: number): WeightBand {
  if (priorityWeight <= 2) return 'BAIXO';
  if (priorityWeight === 3) return 'MEDIO';
  return 'ALTO';
}

// Matriz fixa aprovada (2026-06-25).
const MATRIX: Record<Complexity, Record<WeightBand, Priority>> = {
  LOW: { BAIXO: 'LOW', MEDIO: 'LOW', ALTO: 'MEDIUM' },
  MEDIUM: { BAIXO: 'LOW', MEDIO: 'MEDIUM', ALTO: 'HIGH' },
  HIGH: { BAIXO: 'MEDIUM', MEDIO: 'HIGH', ALTO: 'URGENT' },
  CRITICAL: { BAIXO: 'HIGH', MEDIO: 'URGENT', ALTO: 'URGENT' },
};

export function computePriority(complexity: Complexity, priorityWeight: number): Priority {
  return MATRIX[complexity][weightBand(priorityWeight)];
}
