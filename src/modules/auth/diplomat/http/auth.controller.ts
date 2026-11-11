import { Body, Controller, HttpCode, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { Login } from '../../use-cases/login.js';
import { InvalidCredentialsError } from '../../use-cases/auth.errors.js';
import { LoginRequest } from '../../wire/in/login.request.js';
import type { LoginResponse } from '../../wire/out/login.response.js';
import { toLoginInput, toLoginResponse } from '../../adapters/auth.http.adapter.js';
import { Public } from './auth.decorators.js';
@Controller('auth')
export class AuthController {
  constructor(@Inject(Login) private readonly login: Login) {}
  @Public()
  @Post('login')
  @HttpCode(200)
  async execute(@Body() request: LoginRequest): Promise<LoginResponse> {
    try {
      return toLoginResponse(await this.login.execute(toLoginInput(request)));
    } catch (error: unknown) {
      if (error instanceof InvalidCredentialsError)
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password.',
        });
      throw error;
    }
  }
}
