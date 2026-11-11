import type { BidResponse } from './bid.response.js';
export interface AuctionResponse {
  readonly id: string;
  readonly vehicle: { readonly brand: string; readonly model: string; readonly vin: string };
  readonly startingPrice: number;
  readonly currency: 'EUR';
  readonly endTime: string;
  readonly status: 'draft' | 'active' | 'ended';
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly highestBid: BidResponse | null;
  readonly winner: BidResponse | null;
}
export interface AuctionPageResponse {
  readonly items: readonly AuctionResponse[];
  readonly limit: number;
  readonly offset: number;
}
