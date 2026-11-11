import { Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { ReservationsController } from './diplomat/http/reservations.controller.js';
import { PrismaReservationStore } from './diplomat/database/prisma-reservation-store.js';
import { ReservationErrorFilter } from './diplomat/http/reservation-error.filter.js';
import { CreateReservation } from './use-cases/create-reservation.js';
import { GetReservation } from './use-cases/get-reservation.js';
import { CancelReservation } from './use-cases/cancel-reservation.js';
import type { ReservationStore } from './use-cases/ports/reservation-store.js';
import type { ReservationRuntime } from './use-cases/ports/reservation-runtime.js';
import { RESERVATION_RUNTIME, RESERVATION_STORE } from './reservations.tokens.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ReservationsController],
  providers: [
    ReservationErrorFilter,
    {
      provide: RESERVATION_RUNTIME,
      useValue: { newId: randomUUID, now: () => new Date() } satisfies ReservationRuntime,
    },
    {
      provide: RESERVATION_STORE,
      inject: [PrismaService],
      useFactory: (database: PrismaService) => new PrismaReservationStore(database),
    },
    {
      provide: CreateReservation,
      inject: [RESERVATION_STORE, RESERVATION_RUNTIME],
      useFactory: (store: ReservationStore, runtime: ReservationRuntime) =>
        new CreateReservation(store, runtime),
    },
    {
      provide: GetReservation,
      inject: [RESERVATION_STORE],
      useFactory: (store: ReservationStore) => new GetReservation(store),
    },
    {
      provide: CancelReservation,
      inject: [RESERVATION_STORE, RESERVATION_RUNTIME],
      useFactory: (store: ReservationStore, runtime: ReservationRuntime) =>
        new CancelReservation(store, runtime),
    },
  ],
})
export class ReservationsModule {}
