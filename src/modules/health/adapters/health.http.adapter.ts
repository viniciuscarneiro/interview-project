import type { Readiness } from '../model/readiness.js';
import type { ReadinessResponse } from '../wire/out/health.response.js';
export function toReadinessResponse(result: Readiness): ReadinessResponse {
  return {
    status: result.ready ? 'ok' : 'error',
    checks: { database: result.ready ? 'up' : 'down' },
  };
}
