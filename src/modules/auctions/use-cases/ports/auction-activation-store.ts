import type { Auction, ActiveAuction, ActivationSnapshot } from '../../model/auction.js';
import type { AuctionReference } from '../../model/auction-reference.js';
export interface AuctionActivationStore {
  /** Lock the referenced row and invoke decide exactly once with its latest state (null if absent).
   * The caller reads its clock inside this synchronous callback, after lock acquisition.
   * Persist the returned activation atomically before releasing the lock. Callback errors roll back.
   * Return the updated auction and highest bid from the same locked snapshot. Concurrent operations serialize; no implicit retries. Unexpected storage errors propagate. */
  activate(
    reference: AuctionReference,
    decide: (current: Auction | null) => ActiveAuction,
  ): Promise<ActivationSnapshot>;
}
