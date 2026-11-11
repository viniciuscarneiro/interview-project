import type { Auction, AuctionSnapshot } from '../../model/auction.js';
import type { ListAuctionsInput } from '../../model/list-auctions.js';
export interface AuctionStore {
  /** Inserts once atomically; unexpected storage failures propagate. No implicit retries. */
  create(auction: Auction): Promise<Auction>;
  /** One read snapshot of auctions and their highest bids, ordered by createdAt descending, then id ascending.
   * Empty pages return []; supports every nonnegative safe-integer offset. */
  list(input: ListAuctionsInput): Promise<readonly AuctionSnapshot[]>;
}
