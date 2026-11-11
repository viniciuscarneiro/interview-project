import { ReservationStatus } from '../../../generated/prisma/client.js';
import type { Prisma, Reservation as ReservationRecord } from '../../../generated/prisma/client.js';
import type { ActiveReservation, Reservation } from '../model/reservation.js';

export function toReservationRecord(
  reservation: ActiveReservation,
): Prisma.ReservationUncheckedCreateInput {
  return {
    id: reservation.id,
    vehicleId: reservation.vehicleId,
    buyerId: reservation.buyerId,
    status: ReservationStatus.ACTIVE,
    createdAt: reservation.createdAt,
    cancelledAt: null,
  };
}

export function toReservationModel(record: ReservationRecord): Reservation {
  const identity = {
    id: record.id,
    vehicleId: record.vehicleId,
    buyerId: record.buyerId,
    createdAt: record.createdAt,
  };
  switch (record.status) {
    case ReservationStatus.ACTIVE:
      if (record.cancelledAt !== null) throw new Error('Inconsistent active reservation record.');
      return { ...identity, status: 'active', cancelledAt: null };
    case ReservationStatus.CANCELLED:
      if (record.cancelledAt === null) throw new Error('Missing cancellation timestamp.');
      return { ...identity, status: 'cancelled', cancelledAt: record.cancelledAt };
  }
}
