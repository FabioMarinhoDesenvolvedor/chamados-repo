import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SlaService } from './sla.service';

const svc = new SlaService();
const start = new Date('2026-07-07T00:00:00.000Z');

test('resolutionDueAt soma as horas da célula ao início', () => {
  // MEDIUM x peso 3 (Médio) = 16h de conclusão.
  const due = svc.resolutionDueAt('MEDIUM', 3, start);
  assert.equal(due.getTime(), start.getTime() + 16 * 3600 * 1000);
});

test('responseDueAt soma as horas de resposta ao início', () => {
  // HIGH x peso 5 (Alto) = 1h de resposta.
  const due = svc.responseDueAt('HIGH', 5, start);
  assert.equal(due.getTime(), start.getTime() + 1 * 3600 * 1000);
});

test('complexidade nula cai em MEDIUM', () => {
  assert.equal(svc.resolutionHours(null, 3), svc.resolutionHours('MEDIUM', 3));
  assert.equal(svc.responseHours(null, 1), svc.responseHours('MEDIUM', 1));
});
