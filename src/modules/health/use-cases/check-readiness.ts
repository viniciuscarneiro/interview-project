import type { Readiness } from '../model/readiness.js';
import type { DatabaseProbe } from './ports/database-probe.js';
export class CheckReadiness {
  constructor(private readonly database: DatabaseProbe) {}
  async execute(): Promise<Readiness> {
    try {
      await this.database.check();
      return { ready: true };
    } catch {
      return { ready: false };
    }
  }
}
