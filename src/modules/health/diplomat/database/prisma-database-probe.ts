import type { PrismaService } from '../../../../infrastructure/database/prisma.service.js';
import type { DatabaseProbe } from '../../use-cases/ports/database-probe.js';
export class PrismaDatabaseProbe implements DatabaseProbe {
  constructor(private readonly database: PrismaService) {}
  async check(): Promise<void> {
    await this.database.$queryRaw`SELECT 1`;
  }
}
