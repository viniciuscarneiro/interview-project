import type { OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(connectionString: string) {
    super({
      adapter: new PrismaPg({
        connectionString,
        max: 5,
        connectionTimeoutMillis: 2000,
        idleTimeoutMillis: 10000,
        statement_timeout: 2000,
        query_timeout: 2500,
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
