import { assertDemoIdentity } from '../logic/demo-accounts.rules.js';
import type { DemoAccountInput } from '../model/demo-account.js';
import type { User } from '../model/user.js';
import type { Passwords } from './ports/passwords.js';
import type { DemoUserStore } from './ports/demo-user-store.js';
export class ProvisionDemoAccounts {
  constructor(
    private readonly users: DemoUserStore,
    private readonly passwords: Passwords,
  ) {}
  async execute(input: readonly DemoAccountInput[]): Promise<void> {
    const users: User[] = [];
    // Hash sequentially to bound scrypt memory during local provisioning.
    for (const account of input)
      users.push({
        id: account.id,
        email: account.email,
        role: account.role,
        passwordHash: await this.passwords.hash(account.password),
      });
    await this.users.provision(users, assertDemoIdentity);
  }
}
