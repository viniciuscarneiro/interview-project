import type { LoginInput, LoginResult } from '../model/login.js';
import type { UserStore } from './ports/user-store.js';
import type { Passwords } from './ports/passwords.js';
import type { AccessTokens } from './ports/access-tokens.js';
import type { AuthClock } from './ports/auth-clock.js';
import { InvalidCredentialsError } from './auth.errors.js';
export class Login {
  constructor(
    private readonly users: UserStore,
    private readonly passwords: Passwords,
    private readonly tokens: AccessTokens,
    private readonly clock: AuthClock,
  ) {}
  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmail(input.email);
    const valid = await this.passwords.verify(input.password, user?.passwordHash ?? null);
    if (!user || !valid) throw new InvalidCredentialsError();
    const token = await this.tokens.issue({ id: user.id, role: user.role }, this.clock.now());
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  }
}
