import type { Reservation as ReservationRecord } from '../../../generated/prisma/client.js';
import { toReservationModel } from './reservation.persistence.adapter.js';

const record: ReservationRecord = {
  id: 'reservation-1',
  vehicleId: 'vehicle-1',
  buyerId: 'buyer-1',
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  cancelledAt: null,
};

describe('Reservation persistence translation', () => {
  it('translates the database enum into internal domain vocabulary', () => {
    expect(toReservationModel(record)).toEqual({ ...record, status: 'active' });
  });

  it('rejects a cancelled record with no timestamp instead of fabricating a value', () => {
    expect(() => toReservationModel({ ...record, status: 'CANCELLED' })).toThrow(
      'Missing cancellation timestamp.',
    );
  });

  it('rejects an active record with a cancellation timestamp', () => {
    expect(() =>
      toReservationModel({ ...record, cancelledAt: new Date('2026-01-01T01:00:00.000Z') }),
    ).toThrow('Inconsistent active reservation record.');
  });
});
