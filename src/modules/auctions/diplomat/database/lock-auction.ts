import type { Prisma } from '../../../../generated/prisma/client.js';
import type { Auction } from '../../model/auction.js';
import type { AuctionReference } from '../../model/auction-reference.js';
import { toAuctionModel } from '../../adapters/auction.persistence.adapter.js';
export async function lockAuction(
  transaction: Prisma.TransactionClient,
  reference: AuctionReference,
): Promise<Auction | null> {
  const locked = await transaction.$queryRaw<
    { id: string }[]
  >`SELECT id FROM auctions WHERE id = ${reference.id}::uuid FOR UPDATE`;
  if (locked.length === 0) return null;
  return toAuctionModel(
    await transaction.auction.findUniqueOrThrow({ where: { id: reference.id } }),
  );
}
