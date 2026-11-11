import type { Auction as AuctionRecord } from '../../../generated/prisma/client.js';
import { toAuctionModel } from './auction.persistence.adapter.js';

const record: AuctionRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  brand: 'Volkswagen',
  model: 'Golf',
  vin: 'WVWZZZ1KZ6W000001',
  startingPrice: 1000000n,
  currency: 'EUR',
  status: 'DRAFT',
  activatedAt: null,
  createdAt: new Date('2026-11-11T12:00:00Z'),
  endTime: new Date('2027-01-01T12:00:00Z'),
  createdBy: '22222222-2222-4222-8222-222222222222',
};

describe('Auction persistence representation', () => {
  it.each([0n, 9007199254740992n])(
    'rejects unrepresentable stored money instead of rounding it',
    (startingPrice) => {
      expect(() => toAuctionModel({ ...record, startingPrice })).toThrow(
        'Unsupported stored starting price.',
      );
    },
  );
  it('rejects a draft with an activation timestamp', () => {
    expect(() => toAuctionModel({ ...record, activatedAt: record.createdAt })).toThrow(
      'Inconsistent draft activation timestamp.',
    );
  });
  it.each([null, new Date('2026-11-11T11:59:59Z'), new Date('2027-01-01T12:00:00Z')])(
    'rejects inconsistent active timestamps',
    (activatedAt) => {
      expect(() => toAuctionModel({ ...record, status: 'ACTIVE', activatedAt })).toThrow(
        'Inconsistent active activation timestamp.',
      );
    },
  );
  it('rejects a currency it cannot represent', () => {
    expect(() => toAuctionModel({ ...record, currency: 'USD' })).toThrow(
      'Unsupported auction representation.',
    );
  });
});
