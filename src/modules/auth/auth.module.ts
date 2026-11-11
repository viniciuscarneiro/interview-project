import { Authenticate } from './use-cases/authenticate.js';
import { DemoAccountsCli } from './diplomat/cli/demo-accounts.cli.js';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { ENVIRONMENT, EnvironmentModule } from '../../config/environment.module.js';
import type { Environment } from '../../config/environment.js';
import { USER_STORE, PASSWORDS, ACCESS_TOKENS, AUTH_CLOCK } from './auth.tokens.js';
import { PrismaUserStore } from './diplomat/database/prisma-user-store.js';
import { ScryptPasswords } from './diplomat/crypto/scrypt-passwords.js';
import { JoseAccessTokens } from './diplomat/crypto/jose-access-tokens.js';
import { AuthController } from './diplomat/http/auth.controller.js';
import { AuthGuard } from './diplomat/http/auth.guard.js';
import { Login } from './use-cases/login.js';
import { ProvisionDemoAccounts } from './use-cases/provision-demo-accounts.js';
import type { UserStore } from './use-cases/ports/user-store.js';
import type { DemoUserStore } from './use-cases/ports/demo-user-store.js';
import type { Passwords } from './use-cases/ports/passwords.js';
import type { AccessTokens } from './use-cases/ports/access-tokens.js';
import type { AuthClock } from './use-cases/ports/auth-clock.js';
@Module({
  imports: [DatabaseModule, EnvironmentModule],
  controllers: [AuthController],
  exports: [DemoAccountsCli],
  providers: [
    {
      provide: Authenticate,
      inject: [ACCESS_TOKENS, AUTH_CLOCK],
      useFactory: (tokens: AccessTokens, clock: AuthClock) => new Authenticate(tokens, clock),
    },
    {
      provide: DemoAccountsCli,
      inject: [ProvisionDemoAccounts],
      useFactory: (provision: ProvisionDemoAccounts) => new DemoAccountsCli(provision),
    },
    {
      provide: USER_STORE,
      inject: [PrismaService],
      useFactory: (db: PrismaService) => new PrismaUserStore(db),
    },
    { provide: PASSWORDS, useFactory: () => new ScryptPasswords() },
    {
      provide: ACCESS_TOKENS,
      inject: [ENVIRONMENT],
      useFactory: (env: Environment) => new JoseAccessTokens(env.authTokenSecret),
    },
    { provide: AUTH_CLOCK, useValue: { now: () => new Date() } satisfies AuthClock },
    {
      provide: Login,
      inject: [USER_STORE, PASSWORDS, ACCESS_TOKENS, AUTH_CLOCK],
      useFactory: (
        users: UserStore,
        passwords: Passwords,
        tokens: AccessTokens,
        clock: AuthClock,
      ) => new Login(users, passwords, tokens, clock),
    },
    {
      provide: ProvisionDemoAccounts,
      inject: [USER_STORE, PASSWORDS],
      useFactory: (users: DemoUserStore, passwords: Passwords) =>
        new ProvisionDemoAccounts(users, passwords),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
