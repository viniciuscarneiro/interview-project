import { toCreateReservationInput, toReservationResponse } from './reservation.http.adapter.js';
import type { ActiveReservation } from '../model/reservation.js';

describe('Reservation HTTP mapping', () => {
  it('canonicalizes case-insensitive UUIDs into internal references', () => {
    expect(
      toCreateReservationInput({
        vehicleId: 'ABCDEFAB-1234-4234-8234-ABCDEFABCDEF',
        buyerId: 'FEDCBAFE-1234-4234-8234-FEDCBAFEDCBA',
      }),
    ).toEqual({
      vehicleId: 'abcdefab-1234-4234-8234-abcdefabcdef',
      buyerId: 'fedcbafe-1234-4234-8234-fedcbafedcba',
    });
  });

  it('serializes only the public fields and represents dates as ISO strings', () => {
    const reservation: ActiveReservation & { internalNote: string } = {
      id: 'reservation-1',
      vehicleId: 'vehicle-1',
      buyerId: 'buyer-1',
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      cancelledAt: null,
      internalNote: 'not public',
    };
    expect(toReservationResponse(reservation)).toEqual({
      id: 'reservation-1',
      vehicleId: 'vehicle-1',
      buyerId: 'buyer-1',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      cancelledAt: null,
    });
  });
});
