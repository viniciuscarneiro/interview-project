import type { User } from '../model/user.js';
import { DemoAccountConflictError } from '../model/demo-account-conflict.error.js';
export function assertDemoIdentity(requested: User, persisted: User): void {
  if (
    persisted.id !== requested.id ||
    persisted.role !== requested.role ||
    persisted.email !== requested.email
  )
    throw new DemoAccountConflictError();
}
