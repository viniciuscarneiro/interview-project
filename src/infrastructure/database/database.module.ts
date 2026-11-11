import { Module } from '@nestjs/common';
import { ENVIRONMENT, EnvironmentModule } from '../../config/environment.module.js';
import type { Environment } from '../../config/environment.js';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [EnvironmentModule],
  providers: [
    {
      provide: PrismaService,
      inject: [ENVIRONMENT],
      useFactory: (environment: Environment) => new PrismaService(environment.databaseUrl),
    },
  ],
  exports: [PrismaService],
})
export class DatabaseModule {}
