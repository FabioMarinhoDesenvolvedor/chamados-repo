import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// Constrói o service com dependências stubadas (só o necessário para cada caso).
function makeService(over: {
  ticket?: Record<string, unknown>;
  assignee?: Record<string, unknown> | null;
  subcategory?: Record<string, unknown> | null;
  department?: Record<string, unknown> | null;
}) {
  const repo = {
    findById: async () => over.ticket ?? null,
    assign: async (id: string, assignedTo: string) => ({ id, assignedTo }),
    closeWithRating: async (args: unknown) => args,
    createWithHistory: async (input: Record<string, unknown>) => ({ id: 'new', ...input }),
    addComment: async (ticketId: string, authorId: string, body: string) => ({
      id: 'c1',
      ticketId,
      authorId,
      body,
      createdAt: new Date(),
      author: {
        id: authorId,
        name: 'Autor',
        email: 'a@x',
        role: 'ADMIN',
        departmentId: null,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  } as any;
  const users = { findById: async () => over.assignee ?? null } as any;
  const departments = { findById: async () => over.department ?? { id: 'dep1', priorityWeight: 3 } } as any;
  const categories = { findSubcategory: async () => over.subcategory ?? null } as any;
  return new TicketsService(repo, departments, users, {} as any, {} as any, categories);
}

const operator: AuthUser = { userId: 'op1', email: 'op@x', role: 'OPERATOR', mustChangePassword: false };
const admin: AuthUser = { userId: 'ad1', email: 'ad@x', role: 'ADMIN', mustChangePassword: false };
const requester: AuthUser = { userId: 'req1', email: 'u@x', role: 'USER', mustChangePassword: false };

// ---- assign ----
test('assign: OPERATOR não pode atribuir a outra pessoa (só assume para si)', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1' } });
  await assert.rejects(() => svc.assign('t1', 'ad1', operator), (e) => e instanceof ForbiddenException);
});

test('assign: OPERATOR pode assumir o chamado para si', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1' }, assignee: { id: 'op1', role: 'OPERATOR' } });
  const r = await svc.assign('t1', 'op1', operator);
  assert.deepEqual(r, { id: 't1', assignedTo: 'op1' });
});

test('assign: ADMIN pode atribuir a um OPERATOR (membro da equipe)', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1' }, assignee: { id: 'op1', role: 'OPERATOR' } });
  const r = await svc.assign('t1', 'op1', admin);
  assert.deepEqual(r, { id: 't1', assignedTo: 'op1' });
});

test('assign: responsável não pode ser um USER comum', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1' }, assignee: { id: 'u9', role: 'USER' } });
  await assert.rejects(() => svc.assign('t1', 'u9', admin), (e) => e instanceof BadRequestException);
});

// ---- close ----
test('close: OPERATOR não pode concluir o chamado (ele resolve, o solicitante/admin conclui)', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'RESOLVED' } });
  await assert.rejects(() => svc.close('t1', 5, operator), (e) => e instanceof ForbiddenException);
});

test('close: o solicitante pode concluir um chamado RESOLVED', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'RESOLVED' } });
  const r = await svc.close('t1', 5, requester);
  assert.equal((r as any).id, 't1');
});

// ---- create (categorização guiada) ----
const subRedefinicao = {
  id: 's1',
  categoryId: 'c1',
  name: 'Redefinição de senha',
  category: { id: 'c1', name: 'Acesso e Senhas' },
};

test('create: deriva o título "Categoria › Subcategoria" e valida a subcategoria', async () => {
  const svc = makeService({ subcategory: subRedefinicao });
  const r: any = await svc.create(
    { categoryId: 'c1', subcategoryId: 's1', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.title, 'Acesso e Senhas › Redefinição de senha');
  assert.equal(r.categoryId, 'c1');
  assert.equal(r.subcategoryId, 's1');
});

test('create: rejeita subcategoria que não pertence à categoria informada', async () => {
  const svc = makeService({ subcategory: subRedefinicao });
  await assert.rejects(
    () => svc.create({ categoryId: 'OUTRA', subcategoryId: 's1', departmentId: 'dep1' } as any, admin),
    (e) => e instanceof BadRequestException,
  );
});

// ---- addComment (bloqueio em chamado encerrado) ----
test('addComment: ADMIN não pode comentar em chamado RESOLVED', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'RESOLVED' } });
  await assert.rejects(() => svc.addComment('t1', 'oi', admin), (e) => e instanceof ForbiddenException);
});

test('addComment: ninguém comenta em chamado CLOSED (nem admin)', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'CLOSED' } });
  await assert.rejects(() => svc.addComment('t1', 'oi', admin), (e) => e instanceof ForbiddenException);
});

test('addComment: chamado em andamento aceita comentário', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'IN_PROGRESS' } });
  const r = await svc.addComment('t1', 'oi', admin);
  assert.equal((r as any).id, 'c1');
});

// ---- hideByRole (projeção por papel) ----
const ticketFields = { priority: 'HIGH' as const, complexity: 'CRITICAL' as const, rating: 4 };

test('hideByRole: USER não vê prioridade/complexidade/nota', () => {
  const svc = makeService({});
  const r = (svc as any).hideByRole({ ...ticketFields }, requester);
  assert.deepEqual(r, { priority: null, complexity: null, rating: null });
});

test('hideByRole: OPERATOR vê prioridade/complexidade, mas NÃO a nota', () => {
  const svc = makeService({});
  const r = (svc as any).hideByRole({ ...ticketFields }, operator);
  assert.deepEqual(r, { priority: 'HIGH', complexity: 'CRITICAL', rating: null });
});

test('hideByRole: ADMIN vê tudo', () => {
  const svc = makeService({});
  const r = (svc as any).hideByRole({ ...ticketFields }, admin);
  assert.deepEqual(r, ticketFields);
});
