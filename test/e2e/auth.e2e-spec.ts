import { DemoAccountsCli } from '../../src/modules/auth/diplomat/cli/demo-accounts.cli.js';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ProvisionDemoAccounts } from '../../src/modules/auth/use-cases/provision-demo-accounts.js';
import { DemoAccountConflictError } from '../../src/modules/auth/model/demo-account-conflict.error.js';
import { createTestApp } from '../support/create-test-app.js';
import { assertTestDatabase } from '../support/test-database.js';

const accounts = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    email: 'admin@example.test',
    role: 'ADMIN' as const,
    password: 'e2e-admin-password',
  },
  {
    id: 'b0000000-0000-4000-8000-000000000002',
    email: 'buyer@example.test',
    role: 'BASIC' as const,
    password: 'e2e-buyer-password',
  },
];

describe('Persisted authentication and demo provisioning', () => {
  let app: INestApplication<Server>;
  let database: PrismaService;
  let provision: ProvisionDemoAccounts;
  async function cleanFixtures(): Promise<void> {
    assertTestDatabase();
    await database.user.deleteMany({
      where: { id: { in: accounts.map((account) => account.id) } },
    });
  }
  beforeAll(async () => {
    assertTestDatabase();
    app = await createTestApp();
    database = app.get(PrismaService);
    provision = app.get(ProvisionDemoAccounts);
  });
  beforeEach(async () => {
    await cleanFixtures();
  });
  afterAll(async () => {
    try {
      await cleanFixtures();
    } finally {
      await app.close();
    }
  });

  it('provisions both profiles once, preserves credentials on repeat, and logs in from persistence', async () => {
    const cli = app.get(DemoAccountsCli);
    await cli.execute({ admin: 'e2e-admin-password', buyer: 'e2e-buyer-password' });
    const original = await database.user.findMany({
      where: { id: { in: accounts.map((account) => account.id) } },
      orderBy: { email: 'asc' },
    });
    expect(original).toHaveLength(2);
    for (const account of accounts) {
      const row = original.find((value) => value.id === account.id);
      expect(row?.passwordHash).toMatch(/^scrypt-v1\$/);
      expect(row?.passwordHash).not.toContain(account.password);
    }
    await cli.execute({
      admin: 'replacement-must-not-take-effect',
      buyer: 'replacement-must-not-take-effect',
    });
    expect(
      await database.user.findMany({
        where: { id: { in: accounts.map((account) => account.id) } },
        orderBy: { email: 'asc' },
      }),
    ).toEqual(original);
    for (const account of accounts) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: account.email, password: account.password })
        .expect(200);
      const body: unknown = response.body;
      if (
        typeof body !== 'object' ||
        body === null ||
        !('accessToken' in body) ||
        typeof body.accessToken !== 'string'
      )
        throw new Error('Missing login token.');
      expect(body).toEqual({
        accessToken: body.accessToken,
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: { id: account.id, email: account.email, role: account.role },
      });
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'buyer@example.test', password: 'e2e-admin-password' })
      .expect(401);
  });

  it('does not promote an existing account and rolls back the batch on conflict', async () => {
    const buyer = accounts[1];
    if (!buyer) throw new Error('Missing fixture.');
    await provision.execute([{ ...buyer, role: 'ADMIN' }]);
    const original = await database.user.findMany({
      where: { id: { in: accounts.map((account) => account.id) } },
    });
    await expect(provision.execute(accounts)).rejects.toThrow(DemoAccountConflictError);
    expect(
      await database.user.findMany({
        where: { id: { in: accounts.map((account) => account.id) } },
      }),
    ).toEqual(original);
    expect(await database.user.findUnique({ where: { email: 'admin@example.test' } })).toBeNull();
  });
});
