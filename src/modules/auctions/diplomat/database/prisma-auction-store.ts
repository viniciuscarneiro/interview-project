import { Prisma } from '../../../../generated/prisma/client.js';
import type {
  Auction as AuctionRecord,
  Bid as BidRecord,
} from '../../../../generated/prisma/client.js';
import type { PrismaService } from '../../../../infrastructure/database/prisma.service.js';
import type { AuctionReference } from '../../model/auction-reference.js';
import type {
  Auction,
  ActiveAuction,
  AuctionSnapshot,
  ActivationSnapshot,
} from '../../model/auction.js';
import type { ListAuctionsInput } from '../../model/list-auctions.js';
import type { AuctionStore } from '../../use-cases/ports/auction-store.js';
import type { AuctionActivationStore } from '../../use-cases/ports/auction-activation-store.js';
import {
  toAuctionRecord,
  toAuctionModel,
  toActivationRecord,
  toActiveAuctionModel,
} from '../../adapters/auction.persistence.adapter.js';
import { toBidModel } from '../../adapters/bid.persistence.adapter.js';
import { lockAuction } from './lock-auction.js';
export class PrismaAuctionStore implements AuctionStore, AuctionActivationStore {
  constructor(private readonly database: PrismaService) {}
  async create(auction: Auction): Promise<Auction> {
    return toAuctionModel(await this.database.auction.create({ data: toAuctionRecord(auction) }));
  }
  async activate(
    reference: AuctionReference,
    decide: (current: Auction | null) => ActiveAuction,
  ): Promise<ActivationSnapshot> {
    return this.database.$transaction(async (transaction) => {
      const next = decide(await lockAuction(transaction, reference));
      const auction = toActiveAuctionModel(
        await transaction.auction.update({
          where: { id: reference.id },
          data: toActivationRecord(next),
        }),
      );
      const highest = await transaction.bid.findFirst({
        where: { auctionId: reference.id },
        orderBy: [{ amount: 'desc' }, { acceptanceOrder: 'asc' }],
      });
      return { auction, highestBid: highest ? toBidModel(highest) : null };
    });
  }
  async list(input: ListAuctionsInput): Promise<readonly AuctionSnapshot[]> {
    // Both bounded queries share one database snapshot. bigint OFFSET preserves
    // the full public safe-integer range; aliases match generated representations.
    return this.database.$transaction(
      async (transaction) => {
        const records = await transaction.$queryRaw<AuctionRecord[]>`
        SELECT id, brand, model, vin, starting_price AS "startingPrice", currency, status,
               end_time AS "endTime", created_at AS "createdAt", created_by AS "createdBy", activated_at AS "activatedAt"
        FROM auctions ORDER BY created_at DESC, id ASC
        LIMIT ${input.limit} OFFSET ${BigInt(input.offset)}
      `;
        if (records.length === 0) return [];
        const leaders = await transaction.$queryRaw<BidRecord[]>`
        SELECT DISTINCT ON (auction_id) id, auction_id AS "auctionId", buyer_id AS "buyerId",
               amount, accepted_at AS "acceptedAt", acceptance_order AS "acceptanceOrder"
        FROM bids WHERE auction_id IN (${Prisma.join(records.map((record) => record.id))})
        ORDER BY auction_id, amount DESC, acceptance_order ASC
      `;
        const byAuction = new Map(leaders.map((record) => [record.auctionId, toBidModel(record)]));
        return records.map((record) => ({
          auction: toAuctionModel(record),
          highestBid: byAuction.get(record.id) ?? null,
        }));
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
