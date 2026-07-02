import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

const config = { get: () => 'segredo-de-teste-bem-grande-123' } as any;
const payload = { sub: 'u1', email: 'a@b.com', role: 'USER' } as any;

test('validate devolve o AuthUser com mustChangePassword/departmentId/isKiosk vindos do banco', async () => {
  const users = {
    findById: async () => ({
      id: 'u1',
      email: 'a@b.com',
      role: 'USER',
      mustChangePassword: true,
      departmentId: 'dep1',
      isKiosk: false,
    }),
  } as any;
  const strategy = new JwtStrategy(config, users);

  const result = await strategy.validate(payload);
  assert.deepEqual(result, {
    userId: 'u1',
    email: 'a@b.com',
    role: 'USER',
    mustChangePassword: true,
    departmentId: 'dep1',
    isKiosk: false,
  });
});

test('validate rejeita (401) quando o usuário não existe mais (token de usuário excluído)', async () => {
  const users = { findById: async () => null } as any;
  const strategy = new JwtStrategy(config, users);

  await assert.rejects(() => strategy.validate(payload), (err: unknown) => err instanceof UnauthorizedException);
});
