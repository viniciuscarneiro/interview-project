import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ProvisionDemoAccounts } from '../../src/modules/auth/use-cases/provision-demo-accounts.js';
import { AUTH_CLOCK } from '../../src/modules/auth/auth.tokens.js';
import { AUCTION_RUNTIME } from '../../src/modules/auctions/auctions.tokens.js';
import { assertTestDatabase } from '../support/test-database.js';

const start = new Date('2026-11-11T12:00:00.000Z');
const endTime = new Date(start.getTime() + 10_000);
const auctionId = 'f0000000-0000-4000-8000-000000000001';
const admin = {
  id: 'f1000000-0000-4000-8000-000000000001',
  email: 'activation-admin@example.test',
  role: 'ADMIN' as const,
  password: 'activation-test-password',
};
const draft = {
  id: auctionId,
  vehicle: { brand: 'Volkswagen', model: 'Golf', vin: 'WVWZZZ1KZ6W000001' },
  startingPrice: 10000,
  currency: 'EUR',
  endTime: endTime.toISOString(),
  status: 'draft',
  createdAt: start.toISOString(),
  activatedAt: null,
  highestBid: null,
  winner: null,
};

describe('Atomic auction activation', () => {
  let app: INestApplication<Server>;
  let database: PrismaService;
  let token: string;
  let now = start.getTime();
  let advanceClock = false;
  beforeAll(async () => {
    assertTestDatabase();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_CLOCK)
      .useValue({ now: () => start })
      .overrideProvider(AUCTION_RUNTIME)
      .useValue({
        newId: () => auctionId,
        now: () => {
          const value = new Date(now);
          if (advanceClock) now++;
          return value;
        },
      })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.init();
    database = app.get(PrismaService);
    await database.auction.deleteMany({ where: { id: auctionId } });
    await database.user.deleteMany({ where: { id: admin.id } });
    await app.get(ProvisionDemoAccounts).execute([admin]);
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: admin.email, password: admin.password })
      .expect(200);
    const body: unknown = response.body;
    if (
      typeof body !== 'object' ||
      body === null ||
      !('accessToken' in body) ||
      typeof body.accessToken !== 'string'
    )
      throw new Error('Missing login token.');
    token = body.accessToken;
  });
  beforeEach(async () => {
    assertTestDatabase();
    now = start.getTime();
    advanceClock = false;
    await database.auction.deleteMany({ where: { id: auctionId } });
    await request(app.getHttpServer())
      .post('/auctions')
      .set('Authorization', `Bearer ${token}`)
      .send({ vehicle: draft.vehicle, startingPrice: draft.startingPrice, endTime: draft.endTime })
      .expect(201)
      .expect(draft);
  });
  afterAll(async () => {
    try {
      assertTestDatabase();
      await database.auction.deleteMany({ where: { id: auctionId } });
      await database.user.deleteMany({ where: { id: admin.id } });
    } finally {
      await app.close();
    }
  });

  it('preserves one activation timestamp across concurrent requests and repeats', async () => {
    now = start.getTime() + 1000;
    advanceClock = true;
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app.getHttpServer())
          .post(`/auctions/${auctionId}/activate`)
          .set('Authorization', `Bearer ${token}`),
      ),
    );
    const expected = {
      ...draft,
      status: 'active',
      activatedAt: new Date(start.getTime() + 1000).toISOString(),
    };
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expected);
    }
    const record = await database.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(record.status).toBe('ACTIVE');
    expect(record.activatedAt).toEqual(new Date(start.getTime() + 1000));
    now = start.getTime() + 2000;
    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(expected);
    await request(app.getHttpServer())
      .get('/auctions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ items: [expected], limit: 20, offset: 0 });
  });

  it('rechecks the deadline after waiting for an actual database row lock', async () => {
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
      if (!pid) throw new Error('Missing lock-holder process.');
      await holder.query('SELECT id FROM auctions WHERE id = $1::uuid FOR UPDATE', [auctionId]);
      now = start.getTime() + 1000;
      const activation = request(app.getHttpServer())
        .post(`/auctions/${auctionId}/activate`)
        .set('Authorization', `Bearer ${token}`)
        .then((response) => response);
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
          // Synchronize on observed lock contention, never on elapsed auction time.
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
        now = endTime.getTime();
      } finally {
        await holder.query('ROLLBACK');
        await activation;
      }
      const response = await activation;
      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        statusCode: 409,
        code: 'AUCTION_ENDED',
        message: 'Auction has ended.',
      });
      const record = await database.auction.findUniqueOrThrow({ where: { id: auctionId } });
      expect(record.status).toBe('DRAFT');
      expect(record.activatedAt).toBeNull();
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
      await pool.end();
    }
  });
});
