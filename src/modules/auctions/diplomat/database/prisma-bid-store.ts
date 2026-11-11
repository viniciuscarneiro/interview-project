import type { PrismaService } from '../../../../infrastructure/database/prisma.service.js';
import type { Auction } from '../../model/auction.js';
import type { AuctionReference } from '../../model/auction-reference.js';
import type { Bid } from '../../model/bid.js';
import type { BidStore } from '../../use-cases/ports/bid-store.js';
import { toBidModel, toBidRecord } from '../../adapters/bid.persistence.adapter.js';
import { lockAuction } from './lock-auction.js';
export class PrismaBidStore implements BidStore {
  constructor(private readonly database: PrismaService) {}
  async place(
    reference: AuctionReference,
    decide: (auction: Auction | null, highest: Bid | null, nextOrder: bigint) => Bid,
  ): Promise<Bid> {
    return this.database.$transaction(async (transaction) => {
      const auction = await lockAuction(transaction, reference);
      const highest = auction
        ? await transaction.bid.findFirst({
            where: { auctionId: reference.id },
            orderBy: [{ amount: 'desc' }, { acceptanceOrder: 'asc' }],
          })
        : null;
      const last = auction
        ? await transaction.bid.findFirst({
            where: { auctionId: reference.id },
            orderBy: { acceptanceOrder: 'desc' },
          })
        : null;
      const bid = decide(
        auction,
        highest ? toBidModel(highest) : null,
        (last?.acceptanceOrder ?? 0n) + 1n,
      );
      return toBidModel(await transaction.bid.create({ data: toBidRecord(bid) }));
    });
  }
}
