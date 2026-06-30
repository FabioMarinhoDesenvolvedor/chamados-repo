import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { MustChangePasswordGuard } from './must-change-password.guard';

// Reflector falso: devolve um valor fixo para getAllAndOverride.
function reflectorReturning(skip: boolean | undefined) {
  return { getAllAndOverride: () => skip } as any;
}

// ExecutionContext falso com o `user` na request.
function ctxWithUser(user: unknown) {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

test('libera quando a rota está marcada com @SkipPasswordChangeCheck, mesmo com flag ativa', () => {
  const guard = new MustChangePasswordGuard(reflectorReturning(true));
  assert.equal(guard.canActivate(ctxWithUser({ mustChangePassword: true })), true);
});

test('libera quando o usuário não precisa trocar a senha', () => {
  const guard = new MustChangePasswordGuard(reflectorReturning(undefined));
  assert.equal(guard.canActivate(ctxWithUser({ mustChangePassword: false })), true);
});

test('bloqueia (403) quando precisa trocar a senha e a rota não está liberada', () => {
  const guard = new MustChangePasswordGuard(reflectorReturning(undefined));
  assert.throws(
    () => guard.canActivate(ctxWithUser({ mustChangePassword: true })),
    (err: unknown) => err instanceof ForbiddenException,
  );
});

test('não bloqueia quando não há usuário na request (autenticação é responsabilidade do JwtAuthGuard)', () => {
  const guard = new MustChangePasswordGuard(reflectorReturning(undefined));
  assert.equal(guard.canActivate(ctxWithUser(undefined)), true);
});
