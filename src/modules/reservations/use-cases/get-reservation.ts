import type { Reservation } from '../model/reservation.js';
import type { ReservationStore } from './ports/reservation-store.js';
import { ReservationNotFoundError } from './reservation.errors.js';

export class GetReservation {
  constructor(private readonly store: ReservationStore) {}

  async execute(id: string): Promise<Reservation> {
    const reservation = await this.store.findById(id);
    if (!reservation) throw new ReservationNotFoundError();
    return reservation;
  }
}
