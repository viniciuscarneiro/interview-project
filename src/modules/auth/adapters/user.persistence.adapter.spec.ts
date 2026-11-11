import { toUserRecord } from './user.persistence.adapter.js';

describe('User persistence mapping', () => {
  it('writes only the declared persistence fields, excluding internal additions', () => {
    const user = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'buyer@example.test',
      role: 'BASIC' as const,
      passwordHash: 'test-only-hash',
      internalNote: 'must not reach Prisma',
    };
    expect(toUserRecord(user)).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'buyer@example.test',
      role: 'BASIC',
      passwordHash: 'test-only-hash',
    });
  });
});
