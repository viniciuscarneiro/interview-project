import type { Bid as BidRecord, Prisma } from '../../../generated/prisma/client.js';
import type { Bid } from '../model/bid.js';
export function toBidRecord(bid: Bid): Prisma.BidUncheckedCreateInput {
  return {
    id: bid.id,
    auctionId: bid.auctionId,
    buyerId: bid.buyerId,
    amount: BigInt(bid.amount),
    acceptedAt: bid.acceptedAt,
    acceptanceOrder: bid.acceptanceOrder,
  };
}
export function toBidModel(record: BidRecord): Bid {
  const amount = Number(record.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0 || record.acceptanceOrder <= 0n)
    throw new Error('Unsupported bid representation.');
  return {
    id: record.id,
    auctionId: record.auctionId,
    buyerId: record.buyerId,
    amount,
    acceptedAt: record.acceptedAt,
    acceptanceOrder: record.acceptanceOrder,
  };
}
