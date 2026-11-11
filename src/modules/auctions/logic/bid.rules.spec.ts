import { acceptBid } from './bid.rules.js';
import type { ActiveAuction } from '../model/auction.js';
import type { Bid } from '../model/bid.js';
import { AuctionEndedError, AuctionNotFoundError } from '../model/auction.errors.js';
import {
  AuctionNotActiveError,
  BidTooLowError,
  InvalidBidAmountError,
} from '../model/bid.errors.js';

const at = new Date('2026-11-11T12:00:01Z');
const auction: ActiveAuction = {
  id: 'auction',
  vehicle: { brand: 'VW', model: 'Golf', vin: 'WVWZZZ1KZ6W000001' },
  startingPrice: 10000,
  currency: 'EUR',
  status: 'active',
  activatedAt: at,
  createdAt: new Date('2026-11-11T12:00:00Z'),
  endTime: new Date('2026-11-11T12:01:00Z'),
  createdBy: 'admin',
};
const leader: Bid = {
  id: 'first',
  auctionId: auction.id,
  buyerId: 'buyer-one',
  amount: 11000,
  acceptedAt: at,
  acceptanceOrder: 1n,
};
const input = { auctionId: auction.id, buyerId: 'buyer-two', amount: 11000 };

describe('Bidding rules', () => {
  it('accepts an equal highest bid without changing the existing leader', () => {
    expect(acceptBid(auction, leader, input, 'second', at, 2n)).toEqual({
      id: 'second',
      auctionId: 'auction',
      buyerId: 'buyer-two',
      amount: 11000,
      acceptedAt: at,
      acceptanceOrder: 2n,
    });
    expect(leader.id).toBe('first');
    expect(leader.acceptanceOrder).toBe(1n);
  });
  it('accepts the starting price as the first bid', () => {
    expect(acceptBid(auction, null, { ...input, amount: 10000 }, 'first', at, 1n).amount).toBe(
      10000,
    );
  });
  it('rejects absent, ended, and inactive auctions in contract order', () => {
    expect(() => acceptBid(null, null, input, 'id', at, 1n)).toThrow(AuctionNotFoundError);
    const draft = { ...auction, status: 'draft' as const, activatedAt: null };
    expect(() => acceptBid(draft, null, input, 'id', auction.endTime, 1n)).toThrow(
      AuctionEndedError,
    );
    expect(() => acceptBid(draft, null, input, 'id', at, 1n)).toThrow(AuctionNotActiveError);
  });
  it.each([new Date('2026-11-11T12:01:00Z'), new Date('2026-11-11T12:01:00.001Z')])(
    'rejects a bid at or after the deadline',
    (time) => {
      expect(() => acceptBid(auction, leader, input, 'id', time, 2n)).toThrow(AuctionEndedError);
    },
  );
  it('rejects amounts below either the starting price or highest bid', () => {
    expect(() => acceptBid(auction, null, { ...input, amount: 9999 }, 'id', at, 1n)).toThrow(
      BidTooLowError,
    );
    expect(() => acceptBid(auction, leader, { ...input, amount: 10999 }, 'id', at, 2n)).toThrow(
      BidTooLowError,
    );
  });
  it.each([0, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid money %s', (amount) => {
    expect(() => acceptBid(auction, null, { ...input, amount }, 'id', at, 1n)).toThrow(
      InvalidBidAmountError,
    );
  });
});
