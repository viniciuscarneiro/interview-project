import type { AuthenticateInput } from '../model/authenticate.input.js';
import type { Actor } from '../model/actor.js';
import type { AccessTokens } from './ports/access-tokens.js';
import type { AuthClock } from './ports/auth-clock.js';
export class Authenticate {
  constructor(
    private readonly tokens: AccessTokens,
    private readonly clock: AuthClock,
  ) {}
  execute(input: AuthenticateInput): Promise<Actor> {
    return this.tokens.verify(input.token, this.clock.now());
  }
}
