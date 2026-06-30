import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isStaffRole } from './roles';

test('isStaffRole: ADMIN e OPERATOR são staff; USER não', () => {
  assert.equal(isStaffRole('ADMIN'), true);
  assert.equal(isStaffRole('OPERATOR'), true);
  assert.equal(isStaffRole('USER'), false);
});
