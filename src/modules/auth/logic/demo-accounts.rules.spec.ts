import { assertDemoIdentity } from './demo-accounts.rules.js';
import { DemoAccountConflictError } from '../model/demo-account-conflict.error.js';
import type { User } from '../model/user.js';

const requested: User = {
  id: 'user',
  email: 'buyer@example.test',
  role: 'BASIC',
  passwordHash: 'new-hash',
};
describe('Pure demo-account identity policy', () => {
  it('accepts the same identity without changing an existing password', () => {
    const persisted = { ...requested, passwordHash: 'existing-hash' };
    expect(() => assertDemoIdentity(requested, persisted)).not.toThrow();
    expect(persisted.passwordHash).toBe('existing-hash');
  });
  it('rejects changes to the persisted ID, email, or role', () => {
    const conflicts: readonly User[] = [
      { ...requested, id: 'another-user' },
      { ...requested, email: 'another@example.test' },
      { ...requested, role: 'ADMIN' },
    ];
    for (const persisted of conflicts)
      expect(() => assertDemoIdentity(requested, persisted)).toThrow(DemoAccountConflictError);
  });
});
