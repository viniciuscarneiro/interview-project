import type { Auction as AuctionRecord, Prisma } from '../../../generated/prisma/client.js';
import type { Auction, ActiveAuction } from '../model/auction.js';
export function toAuctionRecord(auction: Auction): Prisma.AuctionUncheckedCreateInput {
  return {
    id: auction.id,
    brand: auction.vehicle.brand,
    model: auction.vehicle.model,
    vin: auction.vehicle.vin,
    startingPrice: BigInt(auction.startingPrice),
    currency: auction.currency,
    status: toStoredStatus(auction.status),
    activatedAt: auction.activatedAt,
    endTime: auction.endTime,
    createdAt: auction.createdAt,
    createdBy: auction.createdBy,
  };
}
export function toAuctionModel(record: AuctionRecord): Auction {
  const startingPrice = Number(record.startingPrice);
  if (!Number.isSafeInteger(startingPrice) || startingPrice <= 0)
    throw new Error('Unsupported stored starting price.');
  if (record.currency !== 'EUR') throw new Error('Unsupported auction representation.');
  const details = {
    id: record.id,
    vehicle: { brand: record.brand, model: record.model, vin: record.vin },
    startingPrice,
    currency: record.currency,
    endTime: record.endTime,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
  };
  switch (record.status) {
    case 'DRAFT':
      if (record.activatedAt !== null) throw new Error('Inconsistent draft activation timestamp.');
      return { ...details, currency: 'EUR', status: 'draft', activatedAt: null };
    case 'ACTIVE':
      if (
        !record.activatedAt ||
        !Number.isFinite(record.activatedAt.getTime()) ||
        record.activatedAt < record.createdAt ||
        record.activatedAt >= record.endTime
      )
        throw new Error('Inconsistent active activation timestamp.');
      return { ...details, currency: 'EUR', status: 'active', activatedAt: record.activatedAt };
    default:
      throw new Error('Unsupported auction representation.');
  }
}
export function toActivationRecord(auction: ActiveAuction): Prisma.AuctionUpdateInput {
  return { status: 'ACTIVE', activatedAt: auction.activatedAt };
}
export function toActiveAuctionModel(record: AuctionRecord): ActiveAuction {
  const auction = toAuctionModel(record);
  if (auction.status !== 'active') throw new Error('Expected a persisted activation.');
  return auction;
}

function toStoredStatus(status: Auction['status']): AuctionRecord['status'] {
  switch (status) {
    case 'draft':
      return 'DRAFT';
    case 'active':
      return 'ACTIVE';
    default:
      throw new Error('Unsupported auction state.');
  }
}
