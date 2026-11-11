import { SignJWT, jwtVerify, errors } from 'jose';
import { isUUID } from 'class-validator';
import type { AccessTokens } from '../../use-cases/ports/access-tokens.js';
import type { Actor } from '../../model/actor.js';
import type { AccessToken } from '../../model/login.js';
import { InvalidTokenError } from '../../model/invalid-token.error.js';
import { toActor, toAccessTokenPayload } from '../../adapters/access-token.adapter.js';
const issuer = 'vehicle-auction-api';
const audience = 'vehicle-auction-client';
export class JoseAccessTokens implements AccessTokens {
  private readonly key: Uint8Array;
  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }
  async issue(actor: Actor, at: Date): Promise<AccessToken> {
    const issuedAt = Math.floor(at.getTime() / 1000);
    const value = await new SignJWT({ ...toAccessTokenPayload(actor) })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 3600)
      .sign(this.key);
    return { value, expiresIn: 3600 };
  }
  async verify(token: string, at: Date): Promise<Actor> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        typ: 'JWT',
        issuer,
        audience,
        currentDate: at,
        requiredClaims: ['sub', 'role', 'iat', 'exp'],
        maxTokenAge: 3600,
      });
      if (
        !payload.sub ||
        !isUUID(payload.sub) ||
        (payload['role'] !== 'ADMIN' && payload['role'] !== 'BASIC')
      )
        throw new InvalidTokenError();
      return toActor({ sub: payload.sub, role: payload['role'] });
    } catch (error: unknown) {
      if (error instanceof errors.JOSEError) throw new InvalidTokenError();
      throw error;
    }
  }
}
