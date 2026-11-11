import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ProvisionDemoAccounts } from '../../src/modules/auth/use-cases/provision-demo-accounts.js';
import { AUTH_CLOCK } from '../../src/modules/auth/auth.tokens.js';
import { AUCTION_RUNTIME } from '../../src/modules/auctions/auctions.tokens.js';
import { assertTestDatabase } from '../support/test-database.js';

const start = new Date('2026-11-11T12:00:00.000Z');
const auctionIds = [
  'e0000000-0000-4000-8000-000000000003',
  'e0000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000001',
];
const accounts = [
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    email: 'auction-admin@example.test',
    role: 'ADMIN' as const,
    password: 'auction-admin-test-password',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000002',
    email: 'auction-buyer@example.test',
    role: 'BASIC' as const,
    password: 'auction-buyer-test-password',
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

describe('Persisted auction creation and listing', () => {
  let app: INestApplication<Server>;
  let database: PrismaService;
  let now = start;
  let nextId = 0;
  async function openApp(): Promise<void> {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_CLOCK)
      .useValue({ now: () => start })
      .overrideProvider(AUCTION_RUNTIME)
      .useValue({
        now: () => now,
        newId: () => {
          const id = auctionIds[nextId++];
          if (!id) throw new Error('No fixture ID available.');
          return id;
        },
      })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.init();
    database = app.get(PrismaService);
  }
  async function cleanFixtures(): Promise<void> {
    assertTestDatabase();
    await database.auction.deleteMany({ where: { id: { in: auctionIds } } });
    await database.user.deleteMany({
      where: { id: { in: accounts.map((account) => account.id) } },
    });
  }
  beforeAll(async () => {
    assertTestDatabase();
    await openApp();
    await cleanFixtures();
    await app.get(ProvisionDemoAccounts).execute(accounts);
  });
  afterAll(async () => {
    try {
      await cleanFixtures();
    } finally {
      await app.close();
    }
  });

  it('persists normalized drafts, exact cents, creator identity, and stable pages across an app restart', async () => {
    const [admin, buyer] = accounts;
    if (!admin || !buyer) throw new Error('Missing account fixtures.');
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: admin.email, password: admin.password })
      .expect(200);
    const buyerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: buyer.email, password: buyer.password })
      .expect(200);
    const adminToken = tokenFrom(adminLogin.body);
    const buyerToken = tokenFrom(buyerLogin.body);
    const expected = [];
    for (const [index, id] of auctionIds.entries()) {
      now = new Date(start.getTime() + (index === 0 ? 0 : 1000));
      const startingPrice = index === 0 ? Number.MAX_SAFE_INTEGER : 1;
      const representation = {
        id,
        vehicle: { brand: 'Volkswagen', model: 'Golf', vin: 'WVWZZZ1KZ6W000001' },
        startingPrice,
        currency: 'EUR',
        endTime: '2027-01-01T12:00:00.000Z',
        status: 'draft',
        createdAt: now.toISOString(),
        activatedAt: null,
        highestBid: null,
        winner: null,
      };
      await request(app.getHttpServer())
        .post('/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vehicle: { brand: ' Volkswagen ', model: ' Golf ', vin: 'wvwzzz1kz6w000001' },
          startingPrice,
          endTime: '2027-01-01T13:00:00+01:00',
        })
        .expect(201)
        .expect(representation);
      expected.push(representation);
    }
    const persisted = await database.auction.findMany({ where: { id: { in: auctionIds } } });
    expect(persisted).toHaveLength(3);
    expect(persisted.every((auction) => auction.createdBy === admin.id)).toBe(true);
    expect(persisted.find((auction) => auction.id === auctionIds[0])?.startingPrice).toBe(
      9007199254740991n,
    );
    await app.close();
    await openApp();
    const ordered = [expected[2], expected[1], expected[0]];
    await request(app.getHttpServer())
      .get('/auctions')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect({ items: ordered, limit: 20, offset: 0 });
    await request(app.getHttpServer())
      .get('/auctions?limit=1&offset=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect({ items: [expected[1]], limit: 1, offset: 1 });
    await request(app.getHttpServer())
      .get(`/auctions?offset=${Number.MAX_SAFE_INTEGER}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect({ items: [], limit: 20, offset: Number.MAX_SAFE_INTEGER });
    now = new Date('2027-01-01T12:00:00.000Z');
    await request(app.getHttpServer())
      .get('/auctions')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect({
        items: ordered.map((auction) => ({ ...auction, status: 'ended' })),
        limit: 20,
        offset: 0,
      });
  });
});
