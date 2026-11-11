import type { CreateAuctionInput } from '../model/create-auction.input.js';
import type { AuctionView } from '../model/auction.js';
import { createDraft, describeAuction } from '../logic/auction.rules.js';
import type { AuctionStore } from './ports/auction-store.js';
import type { AuctionRuntime } from './ports/auction-runtime.js';
export class CreateAuction {
  constructor(
    private readonly store: AuctionStore,
    private readonly runtime: AuctionRuntime,
  ) {}
  async execute(input: CreateAuctionInput): Promise<AuctionView> {
    const at = this.runtime.now();
    const auction = createDraft(input, this.runtime.newId(), at);
    return describeAuction(await this.store.create(auction), at);
  }
}
