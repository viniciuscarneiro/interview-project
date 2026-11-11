import type { DemoAccountsRequest } from '../../wire/in/demo-accounts.request.js';
import type { ProvisionDemoAccounts } from '../../use-cases/provision-demo-accounts.js';
import { toDemoAccountsInput } from '../../adapters/demo-accounts.adapter.js';
export class DemoAccountsCli {
  constructor(private readonly provision: ProvisionDemoAccounts) {}
  execute(request: DemoAccountsRequest): Promise<void> {
    return this.provision.execute(toDemoAccountsInput(request));
  }
}
