import type { AuctionView } from './auction.js';
export interface ListAuctionsInput {
  readonly limit: number;
  readonly offset: number;
}
export interface AuctionPage {
  readonly items: readonly AuctionView[];
  readonly limit: number;
  readonly offset: number;
}
