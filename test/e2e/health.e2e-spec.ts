import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { createTestApp } from '../support/create-test-app.js';

describe('Health HTTP contracts', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports database readiness', async () => {
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({ status: 'ok', checks: { database: 'up' } });
  });
});

describe('Health contracts when PostgreSQL is unreachable', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await createTestApp({
      databaseUrl: 'postgresql://interview:local@127.0.0.1:1/interview_test',
    });
  });
  afterAll(async () => {
    await app.close();
  });

  it('keeps liveness independent of the database', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(200).expect({ status: 'ok' });
  });

  it('reports readiness failure without exposing connection details', async () => {
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect({ status: 'error', checks: { database: 'down' } });
  });
});
