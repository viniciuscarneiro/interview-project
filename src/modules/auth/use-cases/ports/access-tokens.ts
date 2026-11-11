import type { Actor } from '../../model/actor.js';
import type { AccessToken } from '../../model/login.js';
export interface AccessTokens {
  issue(actor: Actor, at: Date): Promise<AccessToken>;
  /** Validates authenticity, claims and expiry; invalid tokens throw InvalidTokenError. */
  verify(token: string, at: Date): Promise<Actor>;
}
