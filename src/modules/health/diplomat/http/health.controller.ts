import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../../auth/diplomat/http/auth.decorators.js';
import { CheckReadiness } from '../../use-cases/check-readiness.js';
import { toReadinessResponse } from '../../adapters/health.http.adapter.js';
import type { LivenessResponse, ReadinessResponse } from '../../wire/out/health.response.js';
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(CheckReadiness) private readonly checkReadiness: CheckReadiness) {}
  @Get('live')
  live(): LivenessResponse {
    return { status: 'ok' };
  }
  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    const result = await this.checkReadiness.execute();
    const response = toReadinessResponse(result);
    if (!result.ready) throw new ServiceUnavailableException(response);
    return response;
  }
}
