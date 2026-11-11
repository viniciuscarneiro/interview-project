import type { Reservation } from '../model/reservation.js';
import type { CreateReservationInput } from '../use-cases/create-reservation.js';
import type { CreateReservationRequest } from '../wire/in/create-reservation.request.js';
import type { ReservationResponse } from '../wire/out/reservation.response.js';

export function toCreateReservationInput(
  request: CreateReservationRequest,
): CreateReservationInput {
  return { vehicleId: request.vehicleId.toLowerCase(), buyerId: request.buyerId.toLowerCase() };
}

export function toReservationResponse(reservation: Reservation): ReservationResponse {
  return {
    id: reservation.id,
    vehicleId: reservation.vehicleId,
    buyerId: reservation.buyerId,
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
    cancelledAt: reservation.cancelledAt?.toISOString() ?? null,
  };
}
