import type { Bid } from './modules/auctions/model/bid.js';
import type { BidStore } from './modules/auctions/use-cases/ports/bid-store.js';
import { BID_STORE } from './modules/auctions/auctions.tokens.js';
import type { AuctionActivationStore } from './modules/auctions/use-cases/ports/auction-activation-store.js';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { ENVIRONMENT } from './config/environment.module.js';
import { PrismaService } from './infrastructure/database/prisma.service.js';
import { AUTH_CLOCK } from './modules/auth/auth.tokens.js';
import { JoseAccessTokens } from './modules/auth/diplomat/crypto/jose-access-tokens.js';

import {
  AUCTION_STORE,
  AUCTION_RUNTIME,
  AUCTION_ACTIVATION_STORE,
} from './modules/auctions/auctions.tokens.js';
import type { AuctionStore } from './modules/auctions/use-cases/ports/auction-store.js';
import type { Auction } from './modules/auctions/model/auction.js';

const secret = 'test-only-secret-with-at-least-32-bytes';
const at = new Date('2026-11-11T12:00:00.000Z');
const payload = {
  vehicle: { brand: 'Volkswagen', model: 'Golf', vin: 'WVWZZZ1KZ6W000001' },
  startingPrice: 1000000,
  endTime: '2027-01-01T12:00:00.000Z',
};

describe('Auction HTTP contracts', () => {
  let app: INestApplication<Server>;
  let adminToken: string;
  let buyerToken: string;
  let rows: Auction[] = [];
  let bids: Bid[] = [];
  let nextId = 0;
  let now = at;
  let storageUnavailable = false;
  const auctionId = 'a1111111-1111-4111-8111-111111111111';
  const store: AuctionStore = {
    create: (auction) => {
      if (storageUnavailable) return Promise.reject(new Error('Sensitive database details'));
      rows.push(auction);
      return Promise.resolve(auction);
    },
    list: (input) => {
      if (storageUnavailable) return Promise.reject(new Error('Sensitive database details'));
      return Promise.resolve(
        rows
          .slice(input.offset, input.offset + input.limit)
          .map((auction) => ({ auction, highestBid: null })),
      );
    },
  };
  const activationStore: AuctionActivationStore = {
    activate: (reference, decide) => {
      if (storageUnavailable) throw new Error('Sensitive database details');
      const next = decide(rows.find((row) => row.id === reference.id) ?? null);
      rows = rows.map((row) => (row.id === reference.id ? next : row));
      return Promise.resolve({ auction: next, highestBid: null });
    },
  };
  const bidStore: BidStore = {
    place: (reference, decide) => {
      if (storageUnavailable) return Promise.reject(new Error('Sensitive database details'));
      const bid = decide(
        rows.find((row) => row.id === reference.id) ?? null,
        null,
        BigInt(bids.length + 1),
      );
      bids.push(bid);
      return Promise.resolve(bid);
    },
  };
  const expectedAuction = {
    id: auctionId,
    vehicle: payload.vehicle,
    startingPrice: 1000000,
    currency: 'EUR',
    endTime: payload.endTime,
    status: 'draft',
    createdAt: at.toISOString(),
    activatedAt: null,
    highestBid: null,
    winner: null,
  };
  beforeAll(async () => {
    const tokens = new JoseAccessTokens(secret);
    adminToken = (
      await tokens.issue({ id: '11111111-1111-4111-8111-111111111111', role: 'ADMIN' }, at)
    ).value;
    buyerToken = (
      await tokens.issue({ id: '22222222-2222-4222-8222-222222222222', role: 'BASIC' }, at)
    ).value;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENVIRONMENT)
      .useValue({ authTokenSecret: secret })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AUTH_CLOCK)
      .useValue({ now: () => at })
      .overrideProvider(AUCTION_STORE)
      .useValue(store)
      .overrideProvider(AUCTION_ACTIVATION_STORE)
      .useValue(activationStore)
      .overrideProvider(BID_STORE)
      .useValue(bidStore)
      .overrideProvider(AUCTION_RUNTIME)
      .useValue({
        now: () => now,
        newId: () =>
          nextId++ === 0
            ? auctionId
            : `b0000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`,
      })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    rows = [];
    bids = [];
    nextId = 0;
    now = at;
    storageUnavailable = false;
  });
  afterAll(async () => {
    await app.close();
  });
  it('rejects repeated activation after expiry and preserves the original timestamp', async () => {
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    now = new Date(at.getTime() + 1000);
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const activatedAt = rows[0]?.activatedAt;
    now = new Date(payload.endTime);
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409)
      .expect({ statusCode: 409, code: 'AUCTION_ENDED', message: 'Auction has ended.' });
    expect(rows[0]?.activatedAt).toEqual(activatedAt);
    await request(app.getHttpServer())
      .get('/auctions')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect({
        items: [
          {
            ...expectedAuction,
            status: 'ended',
            activatedAt: new Date(at.getTime() + 1000).toISOString(),
          },
        ],
        limit: 20,
        offset: 0,
      });
  });
  it('returns an explicit not-found error for activation of an unknown auction', async () => {
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
      .expect({ statusCode: 404, code: 'AUCTION_NOT_FOUND', message: 'Auction not found.' });
  });
  it('validates the activation identifier before storage access', async () => {
    storageUnavailable = true;
    await request(app.getHttpServer())
      .post('/auctions/not-a-uuid/activate')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
  it.each([{ activatedAt: '2026-01-01T00:00:00Z' }, []])(
    'rejects activation payload fields without changing state',
    async (body) => {
      await request(app.getHttpServer())
        .post('/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(400);
      expect(rows[0]?.status).toBe('draft');
      expect(rows[0]?.activatedAt).toBeNull();
    },
  );
  it('requires an Admin for activation and performs no transition for other callers', async () => {
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    await request(app.getHttpServer()).post(`/auctions/${auctionId}/activate`).expect(401);
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/activate`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(403);
    expect(rows[0]?.status).toBe('draft');
  });
  it('keeps unexpected activation failures generic', async () => {
    storageUnavailable = true;
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(500)
      .expect({ statusCode: 500, message: 'Internal server error' });
  });
  it('accepts a Basic bid on an active auction', async () => {
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amount: payload.startingPrice })
      .expect(201)
      .expect({
        id: 'b0000000-0000-4000-8000-000000000002',
        auctionId,
        buyerId: '22222222-2222-4222-8222-222222222222',
        amount: payload.startingPrice,
        acceptedAt: at.toISOString(),
      });
  });
  it('rejects bids on drafts without accepting a bid', async () => {
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amount: payload.startingPrice })
      .expect(409)
      .expect({ statusCode: 409, code: 'AUCTION_NOT_ACTIVE', message: 'Auction is not active.' });
  });
  it.each([{}, { amount: '10000' }, { amount: 10000, buyerId: 'spoofed' }])(
    'rejects invalid bid payloads before storage',
    async (body) => {
      storageUnavailable = true;
      await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send(body)
        .expect(400);
      expect(bids).toEqual([]);
    },
  );
  it('requires a Basic user and a valid auction reference for bidding', async () => {
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/bids`)
      .send({ amount: 10000 })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 10000 })
      .expect(403);
    await request(app.getHttpServer())
      .post('/auctions/not-a-uuid/bids')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amount: 10000 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amount: 10000 })
      .expect(404)
      .expect({ statusCode: 404, code: 'AUCTION_NOT_FOUND', message: 'Auction not found.' });
    expect(bids).toEqual([]);
  });
  it('sanitizes unexpected bid storage failures', async () => {
    storageUnavailable = true;
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amount: 10000 })
      .expect(500)
      .expect({ statusCode: 500, message: 'Internal server error' });
  });
  it('creates a draft for an Admin', async () => {
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...payload,
        vehicle: { brand: ' Volkswagen ', model: ' Golf ', vin: payload.vehicle.vin.toLowerCase() },
        endTime: '2027-01-01T13:00:00+01:00',
      })
      .expect(201)
      .expect(expectedAuction);
    expect(rows[0]?.createdBy).toBe('11111111-1111-4111-8111-111111111111');
  });
  it('lists auctions for a Basic user', async () => {
    await request(app.getHttpServer())
      .get('/auctions')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect({ items: [], limit: 20, offset: 0 });
  });
  it.each([
    {},
    { ...payload, vehicle: [] },
    { ...payload, vehicle: { ...payload.vehicle, brand: '   ' } },
    { ...payload, vehicle: { ...payload.vehicle, vin: 'I'.repeat(17) } },
    { ...payload, vehicle: { ...payload.vehicle, internal: true } },
    { ...payload, createdBy: 'spoofed' },
    ...['100'].map((startingPrice) => ({
      ...payload,
      startingPrice,
    })),
    ...['2027-01-01T12:00:00', '2027-02-30T12:00:00Z'].map((endTime) => ({ ...payload, endTime })),
  ])('rejects malformed create input without persisting it', async (body) => {
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(400);
    expect(rows).toEqual([]);
  });
  it.each([at.toISOString()])('rejects a deadline that is not in the future', async (endTime) => {
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, endTime })
      .expect(400)
      .expect({
        statusCode: 400,
        code: 'INVALID_END_TIME',
        message: 'End time must be in the future.',
      });
    expect(rows).toEqual([]);
  });
  it.each([
    'limit=0',
    'limit=101',
    'offset=-1',
    'offset=9007199254740992',
    'offset=1e3',
    'limit=1&limit=2',
    'unknown=true',
  ])('rejects invalid pagination %s', async (query) => {
    await request(app.getHttpServer())
      .get('/auctions?' + query)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(400);
  });
  it('requires authentication for creation and listing', async () => {
    await request(app.getHttpServer()).post('/auctions').send(payload).expect(401);
    await request(app.getHttpServer()).get('/auctions').expect(401);
    expect(rows).toEqual([]);
  });
  it('sanitizes unexpected persistence failures', async () => {
    storageUnavailable = true;
    const expected = { statusCode: 500, message: 'Internal server error' };
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(500)
      .expect(expected);
    await request(app.getHttpServer())
      .get('/auctions')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(500)
      .expect(expected);
  });
  it('forbids a Basic user from creating auctions', async () => {
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(payload)
      .expect(403);
  });
});
