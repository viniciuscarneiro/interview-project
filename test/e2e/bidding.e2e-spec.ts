import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import request from 'supertest';
import { readEnvironment } from '../../src/config/environment.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ProvisionDemoAccounts } from '../../src/modules/auth/use-cases/provision-demo-accounts.js';
import { AUTH_CLOCK } from '../../src/modules/auth/auth.tokens.js';
import { AUCTION_RUNTIME } from '../../src/modules/auctions/auctions.tokens.js';
import { assertTestDatabase } from '../support/test-database.js';

const start = new Date('2026-11-11T12:00:00Z');
const deadline = new Date(start.getTime() + 60_000);
const auctionId = '90000000-0000-4000-8000-000000000001';
const otherAuctionId = '90000000-0000-4000-8000-000000000002';
const fixtureAuctionIds = [auctionId, otherAuctionId];
const accounts = [
  {
    id: '91000000-0000-4000-8000-000000000001',
    email: 'bid-admin@example.test',
    role: 'ADMIN' as const,
    password: 'bid-admin-test-password',
  },
  {
    id: '92000000-0000-4000-8000-000000000002',
    email: 'bid-buyer-one@example.test',
    role: 'BASIC' as const,
    password: 'bid-buyer-one-password',
  },
  {
    id: '93000000-0000-4000-8000-000000000003',
    email: 'bid-buyer-two@example.test',
    role: 'BASIC' as const,
    password: 'bid-buyer-two-password',
  },
];
function tokenFrom(body: unknown): string {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('accessToken' in body) ||
    typeof body.accessToken !== 'string'
  )
    throw new Error('Missing login token.');
  return body.accessToken;
}

function idFrom(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('id' in body) || typeof body.id !== 'string')
    throw new Error('Missing response ID.');
  return body.id;
}
function queryGate() {
  let entered = () => {};
  let release = () => {};
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { entered, release, reached, released };
}
async function waitForGate(gate: ReturnType<typeof queryGate>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      gate.reached,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('The real query did not reach the synchronization point.')),
          1500,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe('Persisted bidding and winner selection', () => {
  let app: INestApplication<Server>;
  let database: PrismaService;
  let adminToken: string;
  let buyerToken: string;
  let otherBuyerToken: string;
  let now = start;
  let nextId = 0;
  let nextAuctionId: string | undefined;
  let pageGate: ReturnType<typeof queryGate> | undefined;
  let activationGate: ReturnType<typeof queryGate> | undefined;
  beforeAll(async () => {
    assertTestDatabase();
    database = new PrismaService(readEnvironment(process.env).databaseUrl);
    // Synchronization only: execute each actual Prisma query and return its unchanged result.
    // No production test hooks, transaction doubles, or fabricated database responses.
    const observedDatabase = database.$extends({
      query: {
        async $queryRaw({ args, query }) {
          const result: unknown = await query(args);
          const gate = pageGate;
          if (gate) {
            pageGate = undefined;
            gate.entered();
            await gate.released;
          }
          return result;
        },
        auction: {
          async update({ args, query }) {
            const result = await query(args);
            const gate = activationGate;
            if (gate) {
              activationGate = undefined;
              gate.entered();
              await gate.released;
            }
            return result;
          },
        },
      },
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(observedDatabase)
      .overrideProvider(AUTH_CLOCK)
      .useValue({ now: () => start })
      .overrideProvider(AUCTION_RUNTIME)
      .useValue({
        now: () => now,
        newId: () => {
          if (nextAuctionId) {
            const id = nextAuctionId;
            nextAuctionId = undefined;
            return id;
          }
          return `94000000-0000-4000-8000-${String(999999999999 - ++nextId).padStart(12, '0')}`;
        },
      })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.init();
    await database.bid.deleteMany({ where: { auctionId: { in: fixtureAuctionIds } } });
    await database.auction.deleteMany({ where: { id: { in: fixtureAuctionIds } } });
    await database.user.deleteMany({
      where: { id: { in: accounts.map((account) => account.id) } },
    });
    await app.get(ProvisionDemoAccounts).execute(accounts);
    const tokens: string[] = [];
    for (const account of accounts) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: account.email, password: account.password })
        .expect(200);
      tokens.push(tokenFrom(response.body));
    }
    if (!tokens[0] || !tokens[1] || !tokens[2]) throw new Error('Missing fixture tokens.');
    [adminToken, buyerToken, otherBuyerToken] = [tokens[0], tokens[1], tokens[2]];
  });
  beforeEach(async () => {
    assertTestDatabase();
    now = start;
    nextId = 0;
    nextAuctionId = auctionId;
    pageGate = undefined;
    activationGate = undefined;
    await database.bid.deleteMany({ where: { auctionId: { in: fixtureAuctionIds } } });
    await database.auction.deleteMany({ where: { id: { in: fixtureAuctionIds } } });
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vehicle: { brand: 'VW', model: 'Golf', vin: 'WVWZZZ1KZ6W000001' },
        startingPrice: 10000,
        endTime: deadline.toISOString(),
      })
      .expect(201);
    now = new Date(start.getTime() + 1000);
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    now = new Date(start.getTime() + 2000);
  });
  afterAll(async () => {
    try {
      assertTestDatabase();
      await database.bid.deleteMany({ where: { auctionId: { in: fixtureAuctionIds } } });
      await database.auction.deleteMany({ where: { id: { in: fixtureAuctionIds } } });
      await database.user.deleteMany({
        where: { id: { in: accounts.map((account) => account.id) } },
      });
    } finally {
      await app.close();
      await database.$disconnect();
    }
  });
  function bid(amount: number, token = buyerToken, id = auctionId) {
    return request(app.getHttpServer())
      .post(`/auctions/${id}/bids`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount });
  }
  function listing() {
    return request(app.getHttpServer())
      .get('/auctions')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);
  }

  it('serializes equal bids, retains the earliest tie, and awards the highest amount at expiry', async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) => bid(10000, index % 2 ? otherBuyerToken : buyerToken)),
    );
    for (const response of responses) expect(response.status).toBe(201);
    const stored = await database.bid.findMany({
      where: { auctionId },
      orderBy: { acceptanceOrder: 'asc' },
    });
    expect(stored.map((value) => value.acceptanceOrder)).toEqual([1n, 2n, 3n, 4n, 5n, 6n]);
    const first = stored[0];
    const last = stored[5];
    if (!first || !last) throw new Error('Missing persisted bids.');
    expect(first.id > last.id).toBe(true);
    expect(stored.every((value) => value.acceptedAt.getTime() === now.getTime())).toBe(true);
    const leader = {
      id: first.id,
      auctionId,
      buyerId: first.buyerId,
      amount: 10000,
      acceptedAt: now.toISOString(),
    };
    const active = {
      id: auctionId,
      vehicle: { brand: 'VW', model: 'Golf', vin: 'WVWZZZ1KZ6W000001' },
      startingPrice: 10000,
      currency: 'EUR',
      endTime: deadline.toISOString(),
      status: 'active',
      createdAt: start.toISOString(),
      activatedAt: new Date(start.getTime() + 1000).toISOString(),
      highestBid: leader,
      winner: null,
    };
    await listing().expect({ items: [active], limit: 20, offset: 0 });
    await bid(9999).expect(409);
    const higher = await bid(Number.MAX_SAFE_INTEGER).expect(201);
    const higherRecord = await database.bid.findFirstOrThrow({
      where: { auctionId, amount: 9007199254740991n },
    });
    const higherExpected = {
      id: higherRecord.id,
      auctionId,
      buyerId: '92000000-0000-4000-8000-000000000002',
      amount: Number.MAX_SAFE_INTEGER,
      acceptedAt: now.toISOString(),
    };
    expect(higher.body).toEqual(higherExpected);
    await bid(Number.MAX_SAFE_INTEGER, otherBuyerToken).expect(201);
    await bid(Number.MAX_SAFE_INTEGER - 1).expect(409);
    const updated = { ...active, highestBid: higherExpected };
    await listing().expect({ items: [updated], limit: 20, offset: 0 });
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect(updated);
    now = deadline;
    await bid(Number.MAX_SAFE_INTEGER)
      .expect(409)
      .expect({ statusCode: 409, code: 'AUCTION_ENDED', message: 'Auction has ended.' });
    await listing().expect({
      items: [{ ...updated, status: 'ended', winner: higherExpected }],
      limit: 20,
      offset: 0,
    });
    expect(await database.bid.count({ where: { auctionId } })).toBe(8);
  });

  async function createOtherAuction(): Promise<void> {
    nextAuctionId = otherAuctionId;
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vehicle: { brand: 'Ford', model: 'Focus', vin: 'WVWZZZ1KZ6W000002' },
        startingPrice: 10000,
        endTime: deadline.toISOString(),
      })
      .expect(201);
  }

  it('keeps bid orders, leading bids, and winners isolated across concurrent auctions', async () => {
    await createOtherAuction();
    await request(app.getHttpServer())
      .post(`/auctions/${otherAuctionId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const first = await Promise.all([bid(50000), bid(10000, otherBuyerToken, otherAuctionId)]);
    for (const response of first) expect(response.status).toBe(201);
    if (!first[0]) throw new Error('Missing first-auction response.');
    const firstLeaderId = idFrom(first[0].body);
    const second = await Promise.all([
      bid(50000, otherBuyerToken),
      bid(20000, buyerToken, otherAuctionId),
    ]);
    for (const response of second) expect(response.status).toBe(201);
    if (!second[1]) throw new Error('Missing second-auction response.');
    const secondLeaderId = idFrom(second[1].body);
    for (const id of fixtureAuctionIds) {
      const rows = await database.bid.findMany({
        where: { auctionId: id },
        orderBy: { acceptanceOrder: 'asc' },
      });
      expect(rows.map((row) => row.acceptanceOrder)).toEqual([1n, 2n]);
    }
    const leaders = [
      {
        id: otherAuctionId,
        highestBid: { id: secondLeaderId, auctionId: otherAuctionId, amount: 20000 },
        winner: null,
      },
      { id: auctionId, highestBid: { id: firstLeaderId, auctionId, amount: 50000 }, winner: null },
    ];
    expect((await listing()).body).toMatchObject({ items: leaders });
    now = deadline;
    const winners = [
      { ...leaders[0], status: 'ended', winner: { id: secondLeaderId, auctionId: otherAuctionId } },
      { ...leaders[1], status: 'ended', winner: { id: firstLeaderId, auctionId } },
    ];
    expect((await listing()).body).toMatchObject({ items: winners });
    const page = await request(app.getHttpServer())
      .get('/auctions?limit=1&offset=1')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);
    expect(page.body).toMatchObject({ items: [winners[1]], limit: 1, offset: 1 });
  });

  it('lets a concurrent bid proceed only after the activation transaction commits', async () => {
    await createOtherAuction();
    const gate = queryGate();
    activationGate = gate;
    const activating = request(app.getHttpServer())
      .post(`/auctions/${otherAuctionId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .then((response) => response);
    let pendingBid: Promise<request.Response> | undefined;
    try {
      await waitForGate(gate);
      pendingBid = bid(10000, buyerToken, otherAuctionId).then((response) => response);
      let blocked = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const rows = await database.$queryRaw<
          { blocked: boolean }[]
        >`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND query LIKE 'SELECT id FROM auctions%' AND cardinality(pg_blocking_pids(pid)) > 0) AS blocked`;
        if (rows[0]?.blocked) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
    } finally {
      activationGate = undefined;
      gate.release();
      await activating;
      if (pendingBid !== undefined) await pendingBid;
    }
    expect((await activating).status).toBe(200);
    expect((await pendingBid).status).toBe(201);
    const auction = await database.auction.findUniqueOrThrow({ where: { id: otherAuctionId } });
    const accepted = await database.bid.findFirstOrThrow({ where: { auctionId: otherAuctionId } });
    expect(auction.status).toBe('ACTIVE');
    expect(auction.activatedAt).not.toBeNull();
    expect(accepted.acceptedAt.getTime()).toBeGreaterThanOrEqual(
      auction.activatedAt?.getTime() ?? Infinity,
    );
    expect(await database.bid.count({ where: { auctionId: otherAuctionId } })).toBe(1);
  });

  it('keeps a listing snapshot consistent when a higher bid commits between its queries', async () => {
    const initial = await bid(10000).expect(201);
    const initialId = idFrom(initial.body);
    const gate = queryGate();
    pageGate = gate;
    const pendingPage = listing().then((response) => response);
    let higherId: string;
    try {
      await waitForGate(gate);
      const higher = await bid(20000, otherBuyerToken).expect(201);
      higherId = idFrom(higher.body);
      expect(await database.bid.count({ where: { auctionId } })).toBe(2);
    } finally {
      pageGate = undefined;
      gate.release();
      await pendingPage;
    }
    expect((await pendingPage).body).toMatchObject({
      items: [{ id: auctionId, highestBid: { id: initialId, amount: 10000 }, winner: null }],
    });
    expect((await listing()).body).toMatchObject({
      items: [{ id: auctionId, highestBid: { id: higherId, amount: 20000 }, winner: null }],
    });
  });

  it.each(['deadline', 'higher bid'])(
    'rechecks %s after waiting for the auction lock',
    async (scenario) => {
      assertTestDatabase();
      const pool = new Pool({
        connectionString: process.env['TEST_DATABASE_URL'],
        max: 1,
        connectionTimeoutMillis: 2000,
        query_timeout: 2500,
        statement_timeout: 2000,
      });
      const holder = await pool.connect();
      try {
        await holder.query('BEGIN');
        const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]
          ?.pid;
        if (!pid) throw new Error('Missing holder process.');
        await holder.query('SELECT id FROM auctions WHERE id = $1::uuid FOR UPDATE', [auctionId]);
        const pending = bid(10000).then((response) => response);
        try {
          let waiting = false;
          for (let attempt = 0; attempt < 50; attempt++) {
            const result = await database.$queryRaw<
              { waiting: boolean }[]
            >`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid)) AND wait_event_type = 'Lock') AS waiting`;
            if (result[0]?.waiting) {
              waiting = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          expect(waiting).toBe(true);
          if (scenario === 'deadline') now = deadline;
          else
            await holder.query(
              'INSERT INTO bids (id, auction_id, buyer_id, amount, accepted_at, acceptance_order) VALUES ($1::uuid, $2::uuid, $3::uuid, 20000, $4, 1)',
              [
                '95000000-0000-4000-8000-000000000001',
                auctionId,
                '93000000-0000-4000-8000-000000000003',
                now,
              ],
            );
          await holder.query('COMMIT');
        } finally {
          await holder.query('ROLLBACK');
          await pending;
        }
        const response = await pending;
        expect(response.status).toBe(409);
        expect(response.body).toEqual({
          statusCode: 409,
          code: scenario === 'deadline' ? 'AUCTION_ENDED' : 'BID_TOO_LOW',
          message:
            scenario === 'deadline'
              ? 'Auction has ended.'
              : 'Bid must meet the starting price and current highest bid.',
        });
        expect(await database.bid.count({ where: { auctionId } })).toBe(
          scenario === 'deadline' ? 0 : 1,
        );
      } finally {
        await holder.query('ROLLBACK');
        holder.release();
        await pool.end();
      }
    },
  );
});
