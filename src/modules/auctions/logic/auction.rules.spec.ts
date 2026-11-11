import { createDraft, activateAuction, describeAuction } from './auction.rules.js';
import type { DraftAuction } from '../model/auction.js';
import type { Bid } from '../model/bid.js';
import {
  InvalidEndTimeError,
  InvalidStartingPriceError,
  AuctionEndedError,
  AuctionNotFoundError,
} from '../model/auction.errors.js';

const createdAt = new Date('2026-11-11T12:00:00Z');
const endTime = new Date('2026-11-11T12:01:00Z');
const input = {
  vehicle: { brand: 'VW', model: 'Golf', vin: 'WVWZZZ1KZ6W000001' },
  startingPrice: 10000,
  endTime,
  createdBy: 'admin',
};
const draft: DraftAuction = {
  id: 'auction',
  ...input,
  currency: 'EUR',
  status: 'draft',
  activatedAt: null,
  createdAt,
};

describe('Pure auction lifecycle rules', () => {
  it('creates a EUR draft with explicit identity and time without changing its input', () => {
    const before = structuredClone(input);
    expect(createDraft(input, 'auction', createdAt)).toEqual(draft);
    expect(input).toEqual(before);
  });
  it('requires a valid future deadline', () => {
    for (const time of [createdAt, new Date(createdAt.getTime() - 1), new Date('invalid')]) {
      expect(() => createDraft({ ...input, endTime: time }, 'auction', createdAt)).toThrow(
        InvalidEndTimeError,
      );
    }
  });
  it('rejects nonpositive, fractional, or unsafe starting prices', () => {
    for (const startingPrice of [0, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => createDraft({ ...input, startingPrice }, 'auction', createdAt)).toThrow(
        InvalidStartingPriceError,
      );
    }
  });
  it('activates immutably and preserves the first timestamp on repeat', () => {
    const firstTime = new Date(createdAt.getTime() + 1000);
    const active = activateAuction(draft, firstTime);
    expect(active).toEqual({ ...draft, status: 'active', activatedAt: firstTime });
    expect(draft.status).toBe('draft');
    expect(draft.activatedAt).toBeNull();
    expect(activateAuction(active, new Date(firstTime.getTime() + 1000))).toEqual(active);
  });
  it('rejects missing auctions and rejects expired auctions even when already active', () => {
    expect(() => activateAuction(null, createdAt)).toThrow(AuctionNotFoundError);
    const active = { ...draft, status: 'active' as const, activatedAt: createdAt };
    for (const auction of [draft, active]) {
      expect(() => activateAuction(auction, endTime)).toThrow(AuctionEndedError);
      expect(() => activateAuction(auction, new Date(endTime.getTime() + 1))).toThrow(
        AuctionEndedError,
      );
    }
  });
  it('derives ended state and winner only at the deadline without changing stored state', () => {
    const active = { ...draft, status: 'active' as const, activatedAt: createdAt };
    const leader: Bid = {
      id: 'bid',
      auctionId: draft.id,
      buyerId: 'buyer',
      amount: 11000,
      acceptanceOrder: 1n,
      acceptedAt: createdAt,
    };
    expect(describeAuction(active, new Date(endTime.getTime() - 1), leader)).toEqual({
      auction: active,
      status: 'active',
      highestBid: leader,
      winner: null,
    });
    expect(describeAuction(active, endTime, leader)).toEqual({
      auction: active,
      status: 'ended',
      highestBid: leader,
      winner: leader,
    });
    expect(describeAuction(draft, endTime)).toEqual({
      auction: draft,
      status: 'ended',
      highestBid: null,
      winner: null,
    });
    expect(active.status).toBe('active');
  });
});
