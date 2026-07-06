import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildTicketEmail } from './notification-email';

const base = {
  ticketId: 'abc-123',
  title: 'Manutenção › Elétrica › Tomada',
  requesterName: 'João',
  requesterDepartmentName: 'Tesouraria',
  priority: 'HIGH' as const,
  description: null,
  originLocation: null,
  createdAt: new Date('2026-07-06T13:00:00.000Z'),
  appUrl: 'https://chamados.local',
};

test('buildTicketEmail: assunto tem o título e corpo tem solicitante/setor/prioridade e link', () => {
  const { subject, body } = buildTicketEmail(base);
  assert.equal(subject, 'Novo chamado — Manutenção › Elétrica › Tomada');
  assert.match(body, /João/);
  assert.match(body, /Tesouraria/);
  assert.match(body, /HIGH/);
  assert.match(body, /https:\/\/chamados\.local\/tickets\/abc-123/);
});

test('buildTicketEmail: sem appUrl não inclui link; sem descrição não inclui a linha', () => {
  const { body } = buildTicketEmail({ ...base, appUrl: null, description: null });
  assert.doesNotMatch(body, /\/tickets\//);
  assert.doesNotMatch(body, /Descrição:/);
});

test('buildTicketEmail: com descrição e local de origem inclui as duas linhas', () => {
  const { body } = buildTicketEmail({ ...base, description: 'não liga', originLocation: 'Sala 2' });
  assert.match(body, /Descrição: não liga/);
  assert.match(body, /Local de origem: Sala 2/);
});
