import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';

function makeService(over: {
  byName?: Record<string, unknown> | null;
  byId?: Record<string, unknown> | null;
  users?: number;
  tickets?: number;
  categories?: number;
}) {
  const repo = {
    findByName: async () => over.byName ?? null,
    findById: async () => over.byId ?? { id: 'd1', name: 'Manutenção' },
    create: async (data: Record<string, unknown>) => ({ id: 'new', ...data }),
    countUsers: async () => over.users ?? 0,
    countTickets: async () => over.tickets ?? 0,
    countCategories: async () => over.categories ?? 0,
    remove: async (id: string) => ({ id }),
  } as any;
  return new DepartmentsService(repo);
}

test('create: aplica defaults quando as flags não vêm no DTO', async () => {
  const svc = makeService({});
  const r: any = await svc.create({ name: 'Eventos', priorityWeight: 2 } as any);
  assert.equal(r.isRequesterDept, true);
  assert.equal(r.isExecutorDept, false);
  assert.equal(r.requiresApproval, false);
  assert.equal(r.notificationEmail, null);
});

test('create: respeita as flags explícitas do DTO', async () => {
  const svc = makeService({});
  const r: any = await svc.create({
    name: 'Presidência',
    priorityWeight: 5,
    isRequesterDept: false,
    isExecutorDept: true,
    requiresApproval: true,
    notificationEmail: 'presidencia@clube.local',
  } as any);
  assert.equal(r.isExecutorDept, true);
  assert.equal(r.requiresApproval, true);
  assert.equal(r.notificationEmail, 'presidencia@clube.local');
});

test('remove: bloqueia quando o setor tem categoria vinculada (mesmo sem usuário/chamado)', async () => {
  const svc = makeService({ users: 0, tickets: 0, categories: 1 });
  await assert.rejects(() => svc.remove('d1'), (e) => e instanceof ConflictException);
});

test('remove: permite quando não há usuário, chamado nem categoria vinculados', async () => {
  const svc = makeService({ users: 0, tickets: 0, categories: 0 });
  const r = await svc.remove('d1');
  assert.deepEqual(r, { id: 'd1' });
});
