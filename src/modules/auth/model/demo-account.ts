import type { Role } from './actor.js';
export interface DemoAccountInput {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly password: string;
}
