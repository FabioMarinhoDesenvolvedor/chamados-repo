import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { responseHours, resolutionHours } from './sla.matrix';

// Faixas de peso: Baixo = 1-2, Médio = 3, Alto = 4-5.
// Conclusão (spec 2026-07-07 §2): monótona, resposta <= conclusão em toda célula.
const RESOLUTION: Record<string, [number, number, number]> = {
  LOW: [48, 40, 24],
  MEDIUM: [24, 16, 8],
  HIGH: [8, 4, 2],
  CRITICAL: [4, 2, 1],
};
const RESPONSE: Record<string, [number, number, number]> = {
  LOW: [8, 6, 4],
  MEDIUM: [4, 3, 2],
  HIGH: [2, 1, 1],
  CRITICAL: [1, 1, 1],
};
const WEIGHTS: [number, number, number] = [1, 3, 5]; // representantes de Baixo/Médio/Alto

for (const complexity of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const) {
  WEIGHTS.forEach((w, band) => {
    test(`resolutionHours ${complexity} peso ${w} = ${RESOLUTION[complexity][band]}`, () => {
      assert.equal(resolutionHours(complexity, w), RESOLUTION[complexity][band]);
    });
    test(`responseHours ${complexity} peso ${w} = ${RESPONSE[complexity][band]}`, () => {
      assert.equal(responseHours(complexity, w), RESPONSE[complexity][band]);
    });
  });
}

test('faixa Baixo cobre peso 2 e Alto cobre peso 4', () => {
  assert.equal(resolutionHours('MEDIUM', 2), 24); // Baixo
  assert.equal(resolutionHours('MEDIUM', 4), 8); // Alto
});
