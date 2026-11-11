import type { AuthenticateInput } from '../model/authenticate.input.js';
import type { AccessTokenPayload } from '../wire/out/access-token.payload.js';
import type { AccessTokenClaims } from '../wire/in/access-token.claims.js';
import type { Actor } from '../model/actor.js';
export function toActor(claims: AccessTokenClaims): Actor {
  return { id: claims.sub, role: claims.role };
}

export function toAccessTokenPayload(actor: Actor): AccessTokenPayload {
  return { sub: actor.id, role: actor.role };
}

export function toAuthenticateInput(token: string): AuthenticateInput {
  return { token };
}
