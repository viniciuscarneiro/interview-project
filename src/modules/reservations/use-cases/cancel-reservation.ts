import type { Reservation } from '../model/reservation.js';
import { cancelReservation } from '../logic/reservation.rules.js';
import type { ReservationStore } from './ports/reservation-store.js';
import type { ReservationRuntime } from './ports/reservation-runtime.js';
import { ReservationNotFoundError } from './reservation.errors.js';

export class CancelReservation {
  constructor(
    private readonly store: ReservationStore,
    private readonly runtime: ReservationRuntime,
  ) {}

  async execute(id: string): Promise<Reservation> {
    const current = await this.store.findById(id);
    if (!current) throw new ReservationNotFoundError();
    const cancelled = cancelReservation(current, this.runtime.now());
    const persisted = await this.store.cancel(cancelled);
    if (!persisted) throw new ReservationNotFoundError();
    return persisted;
  }
}
