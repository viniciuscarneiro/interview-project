import type { Bid as BidRecord } from '../../../generated/prisma/client.js';
import { toBidModel } from './bid.persistence.adapter.js';

const record: BidRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  auctionId: '22222222-2222-4222-8222-222222222222',
  buyerId: '33333333-3333-4333-8333-333333333333',
  amount: 10000n,
  acceptedAt: new Date('2026-11-11T12:00:00Z'),
  acceptanceOrder: 1n,
};
describe('Bid persistence mapping', () => {
  it.each([{ amount: 0n }, { amount: 9007199254740992n }, { acceptanceOrder: 0n }])(
    'rejects unrepresentable persisted amounts or orders',
    (invalid) => {
      expect(() => toBidModel({ ...record, ...invalid })).toThrow(
        'Unsupported bid representation.',
      );
    },
  );
});
