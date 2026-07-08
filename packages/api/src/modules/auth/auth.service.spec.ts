import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';

function makeService(over: {
  department?: Record<string, unknown> | null;
  upsertedUser?: Record<string, unknown>;
} = {}) {
  const signAsyncCalls: unknown[][] = [];
  const upsertKioskCalls: unknown[][] = [];

  const usersService = {} as any;

  const jwt = {
    signAsync: async (...args: unknown[]) => {
      signAsyncCalls.push(args);
      return 'signed-jwt-token';
    },
  } as any;

  const usersRepo = {
    upsertKiosk: async (data: Record<string, unknown>) => {
      upsertKioskCalls.push([data]);
      return (
        over.upsertedUser ?? {
          id: 42,
          name: data.name,
          email: data.email,
          role: 'USER',
          departmentId: data.departmentId,
          isKiosk: true,
          mustChangePassword: false,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }
      );
    },
  } as any;

  const departmentsRepo = {
    findById: async () => (over.department === undefined ? { id: 1, name: 'TI' } : over.department),
  } as any;

  const svc = new AuthService(usersService, jwt, usersRepo, departmentsRepo);
  return { svc, signAsyncCalls, upsertKioskCalls };
}

test('issueKioskToken: 404 quando o departamento não existe', async () => {
  const { svc } = makeService({ department: null });
  await assert.rejects(
    () => svc.issueKioskToken({ label: 'Recepção', departmentId: 999 }),
    (e) => e instanceof NotFoundException,
  );
});

test('issueKioskToken: upsert do user kiosk com e-mail derivado do label (slug)', async () => {
  const { svc, upsertKioskCalls } = makeService();
  await svc.issueKioskToken({ label: 'Totem Portaria Ção!', departmentId: 1 });

  assert.equal(upsertKioskCalls.length, 1);
  const data = upsertKioskCalls[0][0] as Record<string, unknown>;
  assert.equal(data.email, 'totem-totem-portaria-cao@kiosk.local');
  assert.equal(data.name, 'Totem Portaria Ção!');
  assert.equal(data.departmentId, 1);
  assert.equal(typeof data.passwordHash, 'string');
});

test('issueKioskToken: assina o token com expiresIn de 365 dias', async () => {
  const { svc, signAsyncCalls } = makeService();
  await svc.issueKioskToken({ label: 'Totem A', departmentId: 1 });

  assert.equal(signAsyncCalls.length, 1);
  const [payload, options] = signAsyncCalls[0] as [Record<string, unknown>, Record<string, unknown>];
  assert.equal(payload.sub, 42);
  assert.equal(payload.role, 'USER');
  assert.deepEqual(options, { expiresIn: '365d' });
});

test('issueKioskToken: retorna token, user público e expiresInDays', async () => {
  const { svc } = makeService();
  const result = await svc.issueKioskToken({ label: 'Totem A', departmentId: 1 });

  assert.equal(result.token, 'signed-jwt-token');
  assert.equal(result.expiresInDays, 365);
  assert.equal(result.user.id, 42);
  assert.equal(result.user.isKiosk, true);
  assert.equal((result.user as any).passwordHash, undefined);
});
