import type {
  ActiveReservation,
  CancelledReservation,
  Reservation,
} from '../../model/reservation.js';

export interface ReservationStore {
  /** Atomically insert, or throw VehicleAlreadyReservedError for an active vehicle conflict. */
  create(reservation: ActiveReservation): Promise<Reservation>;
  findById(id: string): Promise<Reservation | null>;
  /** Cancel only if active. Preserve the first cancellation timestamp; null means missing. */
  cancel(reservation: CancelledReservation): Promise<Reservation | null>;
}
