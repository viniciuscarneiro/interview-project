import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { ReservationsModule } from './modules/reservations/reservations.module.js';

@Module({ imports: [HealthModule, ReservationsModule] })
export class AppModule {}
