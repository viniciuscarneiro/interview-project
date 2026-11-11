import type { AuctionReference } from '../model/auction-reference.js';
import type { AuctionView } from '../model/auction.js';
import type { AuctionActivationStore } from './ports/auction-activation-store.js';
import type { AuctionRuntime } from './ports/auction-runtime.js';
import { activateAuction } from '../logic/auction.rules.js';
export class ActivateAuction {
  constructor(
    private readonly store: AuctionActivationStore,
    private readonly runtime: AuctionRuntime,
  ) {}
  async execute(reference: AuctionReference): Promise<AuctionView> {
    const snapshot = await this.store.activate(reference, (current) =>
      activateAuction(current, this.runtime.now()),
    );
    return {
      auction: snapshot.auction,
      status: 'active',
      highestBid: snapshot.highestBid,
      winner: null,
    };
  }
}
