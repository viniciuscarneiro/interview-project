import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { HealthController } from './diplomat/http/health.controller.js';
import { PrismaDatabaseProbe } from './diplomat/database/prisma-database-probe.js';
import { CheckReadiness } from './use-cases/check-readiness.js';
import type { DatabaseProbe } from './use-cases/ports/database-probe.js';
import { DATABASE_PROBE } from './health.tokens.js';
@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [
    {
      provide: DATABASE_PROBE,
      inject: [PrismaService],
      useFactory: (database: PrismaService) => new PrismaDatabaseProbe(database),
    },
    {
      provide: CheckReadiness,
      inject: [DATABASE_PROBE],
      useFactory: (database: DatabaseProbe) => new CheckReadiness(database),
    },
  ],
})
export class HealthModule {}
