import { toBidResponse } from './bid.http.adapter.js';
import type { AuctionReference } from '../model/auction-reference.js';
import type { AuctionIdRequest } from '../wire/in/auction-id.request.js';
import type { Actor } from '../../auth/model/actor.js';
import type { CreateAuctionRequest } from '../wire/in/create-auction.request.js';
import type { ListAuctionsRequest } from '../wire/in/list-auctions.request.js';
import type { AuctionResponse, AuctionPageResponse } from '../wire/out/auction.response.js';
import type { CreateAuctionInput } from '../model/create-auction.input.js';
import type { ListAuctionsInput, AuctionPage } from '../model/list-auctions.js';
import type { AuctionView } from '../model/auction.js';
export function toCreateAuctionInput(
  request: CreateAuctionRequest,
  actor: Actor,
): CreateAuctionInput {
  return {
    vehicle: {
      brand: request.vehicle.brand,
      model: request.vehicle.model,
      vin: request.vehicle.vin,
    },
    startingPrice: request.startingPrice,
    endTime: new Date(request.endTime),
    createdBy: actor.id,
  };
}
export function toListAuctionsInput(request: ListAuctionsRequest): ListAuctionsInput {
  return { limit: request.limit, offset: request.offset };
}
export function toAuctionResponse(view: AuctionView): AuctionResponse {
  const auction = view.auction;
  return {
    id: auction.id,
    vehicle: {
      brand: auction.vehicle.brand,
      model: auction.vehicle.model,
      vin: auction.vehicle.vin,
    },
    startingPrice: auction.startingPrice,
    currency: auction.currency,
    endTime: auction.endTime.toISOString(),
    status: view.status,
    createdAt: auction.createdAt.toISOString(),
    activatedAt: auction.activatedAt?.toISOString() ?? null,
    highestBid: view.highestBid ? toBidResponse(view.highestBid) : null,
    winner: view.winner ? toBidResponse(view.winner) : null,
  };
}
export function toAuctionPageResponse(page: AuctionPage): AuctionPageResponse {
  return { items: page.items.map(toAuctionResponse), limit: page.limit, offset: page.offset };
}

export function toAuctionReference(request: AuctionIdRequest): AuctionReference {
  return { id: request.id.toLowerCase() };
}
