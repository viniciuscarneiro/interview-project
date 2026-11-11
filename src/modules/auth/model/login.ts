import type { Role } from './actor.js';
export interface LoginInput {
  readonly email: string;
  readonly password: string;
}
export interface AccessToken {
  readonly value: string;
  readonly expiresIn: number;
}
export interface LoginResult {
  readonly token: AccessToken;
  readonly user: { readonly id: string; readonly email: string; readonly role: Role };
}
