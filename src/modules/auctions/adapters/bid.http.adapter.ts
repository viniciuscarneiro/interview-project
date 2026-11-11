import type { Actor } from '../../auth/model/actor.js';
import type { AuctionIdRequest } from '../wire/in/auction-id.request.js';
import type { PlaceBidRequest } from '../wire/in/place-bid.request.js';
import type { BidResponse } from '../wire/out/bid.response.js';
import type { Bid, PlaceBidInput } from '../model/bid.js';
export function toPlaceBidInput(
  reference: AuctionIdRequest,
  request: PlaceBidRequest,
  actor: Actor,
): PlaceBidInput {
  return { auctionId: reference.id.toLowerCase(), amount: request.amount, buyerId: actor.id };
}
export function toBidResponse(bid: Bid): BidResponse {
  return {
    id: bid.id,
    auctionId: bid.auctionId,
    buyerId: bid.buyerId,
    amount: bid.amount,
    acceptedAt: bid.acceptedAt.toISOString(),
  };
}
