import type { CancelledReservation, Reservation } from '../model/reservation.js';

export function cancelReservation(reservation: Reservation, at: Date): CancelledReservation {
  if (reservation.status === 'cancelled') return reservation;
  return { ...reservation, status: 'cancelled', cancelledAt: at };
}
