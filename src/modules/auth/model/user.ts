import type { Role } from './actor.js';
export interface User {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly passwordHash: string;
}
