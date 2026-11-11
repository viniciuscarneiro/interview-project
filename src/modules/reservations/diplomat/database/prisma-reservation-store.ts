import { Prisma } from '../../../../generated/prisma/client.js';
import type { PrismaService } from '../../../../infrastructure/database/prisma.service.js';
import type {
  ActiveReservation,
  CancelledReservation,
  Reservation,
} from '../../model/reservation.js';
import { VehicleAlreadyReservedError } from '../../model/reservation.errors.js';
import {
  toReservationModel,
  toReservationRecord,
} from '../../adapters/reservation.persistence.adapter.js';
import type { ReservationStore } from '../../use-cases/ports/reservation-store.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVehicleConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
    return false;
  const adapterError: unknown = error.meta?.['driverAdapterError'];
  if (!isRecord(adapterError)) return false;
  const cause = adapterError['cause'];
  if (!isRecord(cause)) return false;
  const constraint = cause['constraint'];
  return isRecord(constraint) && constraint['index'] === 'reservations_one_active_per_vehicle';
}

export class PrismaReservationStore implements ReservationStore {
  constructor(private readonly database: PrismaService) {}

  async create(reservation: ActiveReservation): Promise<Reservation> {
    try {
      const record = await this.database.reservation.create({
        data: toReservationRecord(reservation),
      });
      return toReservationModel(record);
    } catch (error: unknown) {
      // Only translate the known vehicle constraint; an unrelated unique failure stays unexpected.
      if (isVehicleConflict(error)) throw new VehicleAlreadyReservedError();
      throw error;
    }
  }

  async findById(id: string): Promise<Reservation | null> {
    const record = await this.database.reservation.findUnique({ where: { id } });
    return record ? toReservationModel(record) : null;
  }

  async cancel(reservation: CancelledReservation): Promise<Reservation | null> {
    // Conditional update preserves the first timestamp even when cancellations race.
    await this.database.reservation.updateMany({
      where: { id: reservation.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelledAt: reservation.cancelledAt },
    });
    return this.findById(reservation.id);
  }
}
