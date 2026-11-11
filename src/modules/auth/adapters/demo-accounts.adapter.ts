import type { DemoAccountsRequest } from '../wire/in/demo-accounts.request.js';
import type { DemoAccountInput } from '../model/demo-account.js';
export function toDemoAccountsInput(request: DemoAccountsRequest): readonly DemoAccountInput[] {
  return [
    {
      id: 'a0000000-0000-4000-8000-000000000001',
      email: 'admin@example.test',
      role: 'ADMIN',
      password: request.admin,
    },
    {
      id: 'b0000000-0000-4000-8000-000000000002',
      email: 'buyer@example.test',
      role: 'BASIC',
      password: request.buyer,
    },
  ];
}
