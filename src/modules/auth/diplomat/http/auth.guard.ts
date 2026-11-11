import { Inject, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Authenticate } from '../../use-cases/authenticate.js';
import { toAuthenticateInput } from '../../adapters/access-token.adapter.js';
import type { Role } from '../../model/actor.js';
import { InvalidTokenError } from '../../model/invalid-token.error.js';
import { PUBLIC_ROUTE, REQUIRED_ROLES } from './auth.decorators.js';
import type { AuthenticatedRequest } from './auth.decorators.js';
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(Authenticate) private readonly authenticate: Authenticate,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, targets)) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token =
      typeof header === 'string' && header.length <= 4096
        ? /^Bearer ([^\s]+)$/i.exec(header)?.[1]
        : undefined;
    if (!token) throw unauthorized();
    try {
      request.actor = await this.authenticate.execute(toAuthenticateInput(token));
    } catch (error: unknown) {
      if (error instanceof InvalidTokenError) throw unauthorized();
      throw error;
    }
    const roles = this.reflector.getAllAndOverride<readonly Role[]>(REQUIRED_ROLES, targets);
    if (roles && !roles.includes(request.actor.role))
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Insufficient permissions.',
      });
    return true;
  }
}
function unauthorized(): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: 401,
    code: 'UNAUTHORIZED',
    message: 'Authentication required.',
  });
}
