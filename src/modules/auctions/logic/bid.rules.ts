import type { Auction } from '../model/auction.js';
import type { Bid, PlaceBidInput } from '../model/bid.js';
import { AuctionNotFoundError, AuctionEndedError } from '../model/auction.errors.js';
import {
  AuctionNotActiveError,
  BidTooLowError,
  InvalidBidAmountError,
} from '../model/bid.errors.js';
export function acceptBid(
  auction: Auction | null,
  highest: Bid | null,
  input: PlaceBidInput,
  id: string,
  at: Date,
  acceptanceOrder: bigint,
): Bid {
  if (!auction) throw new AuctionNotFoundError();
  if (at.getTime() >= auction.endTime.getTime()) throw new AuctionEndedError();
  if (auction.status !== 'active') throw new AuctionNotActiveError();
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new InvalidBidAmountError();
  if (input.amount < auction.startingPrice || (highest !== null && input.amount < highest.amount))
    throw new BidTooLowError();
  return {
    id,
    auctionId: auction.id,
    buyerId: input.buyerId,
    amount: input.amount,
    acceptedAt: new Date(at),
    acceptanceOrder,
  };
}
