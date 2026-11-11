import type { ListAuctionsInput, AuctionPage } from '../model/list-auctions.js';
import { describeAuction } from '../logic/auction.rules.js';
import type { AuctionStore } from './ports/auction-store.js';
import type { AuctionRuntime } from './ports/auction-runtime.js';
export class ListAuctions {
  constructor(
    private readonly store: AuctionStore,
    private readonly runtime: AuctionRuntime,
  ) {}
  async execute(input: ListAuctionsInput): Promise<AuctionPage> {
    const at = this.runtime.now();
    const auctions = await this.store.list(input);
    return {
      items: auctions.map(({ auction, highestBid }) => describeAuction(auction, at, highestBid)),
      limit: input.limit,
      offset: input.offset,
    };
  }
}
