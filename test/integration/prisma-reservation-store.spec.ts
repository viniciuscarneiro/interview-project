import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PrismaReservationStore } from '../../src/modules/reservations/diplomat/database/prisma-reservation-store.js';
import { VehicleAlreadyReservedError } from '../../src/modules/reservations/model/reservation.errors.js';
import type {
  ActiveReservation,
  CancelledReservation,
} from '../../src/modules/reservations/model/reservation.js';
import { assertTestDatabase, resetTestDatabase } from '../support/test-database.js';

describe('PostgreSQL reservation port contract', () => {
  let database: PrismaService;
  let store: PrismaReservationStore;
  const reservation = (): ActiveReservation => ({
    id: randomUUID(),
    vehicleId: randomUUID(),
    buyerId: randomUUID(),
    status: 'active',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    cancelledAt: null,
  });

  beforeAll(() => {
    assertTestDatabase();
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL is required.');
    database = new PrismaService(url);
    store = new PrismaReservationStore(database);
  });
  beforeEach(async () => {
    await resetTestDatabase(database);
  });
  afterAll(async () => {
    await database.$disconnect();
  });

  it('round-trips an internal model through the real database', async () => {
    const value = reservation();
    expect(await store.create(value)).toEqual(value);
    expect(await store.findById(value.id)).toEqual(value);
  });

  it('translates only the active vehicle unique constraint into a domain conflict', async () => {
    const value = reservation();
    await store.create(value);
    await expect(store.create({ ...value, id: randomUUID() })).rejects.toBeInstanceOf(
      VehicleAlreadyReservedError,
    );
    await expect(store.create({ ...value, vehicleId: randomUUID() })).rejects.not.toBeInstanceOf(
      VehicleAlreadyReservedError,
    );
  });

  it('preserves one cancellation timestamp when writes race', async () => {
    const value = reservation();
    await store.create(value);
    const first: CancelledReservation = {
      ...value,
      status: 'cancelled',
      cancelledAt: new Date('2026-01-01T11:00:00.000Z'),
    };
    const second: CancelledReservation = {
      ...first,
      cancelledAt: new Date('2026-01-01T12:00:00.000Z'),
    };
    const results = await Promise.all([store.cancel(first), store.cancel(second)]);
    expect(results[0]).toEqual(results[1]);
    const persisted = await store.findById(value.id);
    expect(persisted?.status).toBe('cancelled');
    expect([first.cancelledAt.toISOString(), second.cancelledAt.toISOString()]).toContain(
      persisted?.cancelledAt?.toISOString(),
    );
  });
});
