import type { Bid } from '../model/bid.js';
import type { Auction, AuctionView, ActiveAuction } from '../model/auction.js';
import type { CreateAuctionInput } from '../model/create-auction.input.js';
import {
  InvalidEndTimeError,
  InvalidStartingPriceError,
  AuctionNotFoundError,
  AuctionEndedError,
} from '../model/auction.errors.js';
export function createDraft(input: CreateAuctionInput, id: string, at: Date): Auction {
  if (!Number.isFinite(input.endTime.getTime()) || input.endTime.getTime() <= at.getTime())
    throw new InvalidEndTimeError();
  if (!Number.isSafeInteger(input.startingPrice) || input.startingPrice <= 0)
    throw new InvalidStartingPriceError();
  return {
    id,
    vehicle: { ...input.vehicle },
    startingPrice: input.startingPrice,
    currency: 'EUR',
    endTime: new Date(input.endTime),
    status: 'draft',
    activatedAt: null,
    createdAt: new Date(at),
    createdBy: input.createdBy,
  };
}
export function describeAuction(
  auction: Auction,
  at: Date,
  highestBid: Bid | null = null,
): AuctionView {
  const ended = at.getTime() >= auction.endTime.getTime();
  return {
    auction,
    status: ended ? 'ended' : auction.status,
    highestBid,
    winner: ended ? highestBid : null,
  };
}

export function activateAuction(current: Auction | null, at: Date): ActiveAuction {
  if (!current) throw new AuctionNotFoundError();
  if (at.getTime() >= current.endTime.getTime()) throw new AuctionEndedError();
  if (current.status === 'active') return current;
  return { ...current, status: 'active', activatedAt: new Date(at) };
}
