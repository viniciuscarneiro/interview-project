import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { createTestApp } from '../support/create-test-app.js';
import { resetTestDatabase } from '../support/test-database.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';

function responseId(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('id' in body) || typeof body.id !== 'string') {
    throw new Error('Expected a reservation response with a string ID.');
  }
  return body.id;
}

describe('Reservation HTTP contracts', () => {
  let app: INestApplication<Server>;
  const vehicleId = '11111111-1111-4111-8111-111111111111';
  const buyerId = '22222222-2222-4222-8222-222222222222';

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetTestDatabase(app.get(PrismaService));
  });
  afterAll(async () => {
    await app.close();
  });

  it('creates a persisted active reservation with an explicit response contract', async () => {
    const response = await request(app.getHttpServer())
      .post('/reservations')
      .send({ vehicleId, buyerId })
      .expect(201);
    const body: unknown = response.body;
    if (
      typeof body !== 'object' ||
      body === null ||
      !('id' in body) ||
      typeof body.id !== 'string' ||
      !('createdAt' in body) ||
      typeof body.createdAt !== 'string'
    ) {
      throw new Error('The response must contain string id and createdAt fields.');
    }
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
    expect(body).toEqual({
      id: body.id,
      vehicleId,
      buyerId,
      status: 'active',
      createdAt: body.createdAt,
      cancelledAt: null,
    });
    await request(app.getHttpServer()).get(`/reservations/${body.id}`).expect(200).expect(body);
  });

  it('rejects malformed input rather than accepting invalid domain references', async () => {
    await request(app.getHttpServer())
      .post('/reservations')
      .send({ vehicleId: 'invalid', buyerId })
      .expect(400);
  });

  it('rejects caller-controlled internal fields', async () => {
    await request(app.getHttpServer())
      .post('/reservations')
      .send({ vehicleId, buyerId, status: 'cancelled' })
      .expect(400);
  });

  it('returns a stable not-found error for an unknown reservation', async () => {
    await request(app.getHttpServer()).get(`/reservations/${vehicleId}`).expect(404).expect({
      statusCode: 404,
      code: 'RESERVATION_NOT_FOUND',
      message: 'Reservation not found.',
    });
  });

  it('rejects malformed route IDs before querying persistence', async () => {
    await request(app.getHttpServer()).get('/reservations/not-a-uuid').expect(400);
  });

  it('allows exactly one active reservation under concurrent requests', async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app.getHttpServer()).post('/reservations').send({ vehicleId, buyerId }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409, 409, 409, 409, 409,
    ]);
    for (const response of responses.filter((value) => value.status === 409)) {
      expect(response.body).toEqual({
        statusCode: 409,
        code: 'VEHICLE_ALREADY_RESERVED',
        message: 'Vehicle already has an active reservation.',
      });
    }
    expect(
      await app.get(PrismaService).reservation.count({ where: { vehicleId, status: 'ACTIVE' } }),
    ).toBe(1);
  });

  it('cancels idempotently and permits a new reservation for that vehicle', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send({ vehicleId, buyerId })
      .expect(201);
    const id = responseId(created.body);
    const cancelled = await request(app.getHttpServer()).delete(`/reservations/${id}`).expect(200);
    const body: unknown = cancelled.body;
    expect(body).toHaveProperty('status', 'cancelled');
    if (
      typeof body !== 'object' ||
      body === null ||
      !('cancelledAt' in body) ||
      typeof body.cancelledAt !== 'string'
    ) {
      throw new Error('A cancelled reservation must have a cancellation timestamp.');
    }
    expect(new Date(body.cancelledAt).toISOString()).toBe(body.cancelledAt);
    await request(app.getHttpServer()).delete(`/reservations/${id}`).expect(200).expect(body);
    await request(app.getHttpServer()).get(`/reservations/${id}`).expect(200).expect(body);
    await request(app.getHttpServer())
      .post('/reservations')
      .send({ vehicleId, buyerId })
      .expect(201);
  });

  it('does not cancel a missing reservation', async () => {
    await request(app.getHttpServer()).delete(`/reservations/${vehicleId}`).expect(404).expect({
      statusCode: 404,
      code: 'RESERVATION_NOT_FOUND',
      message: 'Reservation not found.',
    });
  });
});
