import type { Reservation } from '../model/reservation.js';
import type { ReservationStore } from './ports/reservation-store.js';
import type { ReservationRuntime } from './ports/reservation-runtime.js';

export interface CreateReservationInput {
  readonly vehicleId: string;
  readonly buyerId: string;
}

export class CreateReservation {
  constructor(
    private readonly store: ReservationStore,
    private readonly runtime: ReservationRuntime,
  ) {}

  execute(input: CreateReservationInput): Promise<Reservation> {
    return this.store.create({
      id: this.runtime.newId(),
      vehicleId: input.vehicleId,
      buyerId: input.buyerId,
      status: 'active',
      createdAt: this.runtime.now(),
      cancelledAt: null,
    });
  }
}
