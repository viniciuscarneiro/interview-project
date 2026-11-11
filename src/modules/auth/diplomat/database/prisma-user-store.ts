import type { PrismaService } from '../../../../infrastructure/database/prisma.service.js';
import type { UserStore } from '../../use-cases/ports/user-store.js';
import type { DemoUserStore } from '../../use-cases/ports/demo-user-store.js';
import type { User } from '../../model/user.js';
import { toUser, toUserRecord } from '../../adapters/user.persistence.adapter.js';
export class PrismaUserStore implements UserStore, DemoUserStore {
  constructor(private readonly database: PrismaService) {}
  async findByEmail(email: string): Promise<User | null> {
    const record = await this.database.user.findUnique({ where: { email } });
    return record ? toUser(record) : null;
  }
  async provision(
    users: readonly User[],
    validateIdentity: (requested: User, persisted: User) => void,
  ): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      for (const user of users) {
        const record = await transaction.user.upsert({
          where: { email: user.email },
          create: toUserRecord(user),
          update: {},
        });
        validateIdentity(user, toUser(record));
      }
    });
  }
}
