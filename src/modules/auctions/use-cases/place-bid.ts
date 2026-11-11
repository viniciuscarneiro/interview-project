import type { Bid, PlaceBidInput } from '../model/bid.js';
import type { BidStore } from './ports/bid-store.js';
import type { AuctionRuntime } from './ports/auction-runtime.js';
import { acceptBid } from '../logic/bid.rules.js';
export class PlaceBid {
  constructor(
    private readonly store: BidStore,
    private readonly runtime: AuctionRuntime,
  ) {}
  execute(input: PlaceBidInput): Promise<Bid> {
    return this.store.place({ id: input.auctionId }, (auction, highest, order) =>
      acceptBid(auction, highest, input, this.runtime.newId(), this.runtime.now(), order),
    );
  }
}
