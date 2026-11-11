import type { User as UserRecord, Prisma } from '../../../generated/prisma/client.js';
import type { User } from '../model/user.js';
export function toUser(record: UserRecord): User {
  if (record.role !== 'ADMIN' && record.role !== 'BASIC') throw new Error('Unsupported user role.');
  return {
    id: record.id,
    email: record.email,
    role: record.role,
    passwordHash: record.passwordHash,
  };
}

export function toUserRecord(user: User): Prisma.UserUncheckedCreateInput {
  return { id: user.id, email: user.email, role: user.role, passwordHash: user.passwordHash };
}
