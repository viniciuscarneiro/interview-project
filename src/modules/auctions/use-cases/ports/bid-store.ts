import type { Auction } from '../../model/auction.js';
import type { Bid } from '../../model/bid.js';
import type { AuctionReference } from '../../model/auction-reference.js';
export interface BidStore {
  /** Lock the auction row, then read its latest state, highest bid (amount descending,
   * acceptance order ascending), and next durable per-auction order. Invoke decide once
   * synchronously while holding the lock. Persist its returned bid in the same transaction.
   * The caller reads the clock inside decide. Missing auctions are passed as null.
   * Errors roll back all effects; no automatic retries or request deduplication. */
  place(
    reference: AuctionReference,
    decide: (auction: Auction | null, highest: Bid | null, nextOrder: bigint) => Bid,
  ): Promise<Bid>;
}
