import { cancelReservation } from './reservation.rules.js';
import type { ActiveReservation, CancelledReservation } from '../model/reservation.js';

const active: ActiveReservation = {
  id: 'reservation-1',
  vehicleId: 'vehicle-1',
  buyerId: 'buyer-1',
  status: 'active',
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  cancelledAt: null,
};

describe('Reservation cancellation policy', () => {
  it('cancels without mutating the original reservation', () => {
    const at = new Date('2026-01-01T11:00:00.000Z');
    expect(cancelReservation(active, at)).toEqual({
      ...active,
      status: 'cancelled',
      cancelledAt: at,
    });
    expect(active.status).toBe('active');
    expect(active.cancelledAt).toBeNull();
  });

  it('preserves the original timestamp when cancellation is repeated', () => {
    const cancelled: CancelledReservation = {
      ...active,
      status: 'cancelled',
      cancelledAt: new Date('2026-01-01T11:00:00.000Z'),
    };
    expect(cancelReservation(cancelled, new Date('2026-01-02T10:00:00.000Z'))).toEqual(cancelled);
  });
});
