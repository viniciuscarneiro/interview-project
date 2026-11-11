import type { LoginRequest } from '../wire/in/login.request.js';
import type { LoginResponse } from '../wire/out/login.response.js';
import type { LoginInput, LoginResult } from '../model/login.js';
export function toLoginInput(request: LoginRequest): LoginInput {
  return { email: request.email, password: request.password };
}
export function toLoginResponse(result: LoginResult): LoginResponse {
  return {
    accessToken: result.token.value,
    tokenType: 'Bearer',
    expiresIn: result.token.expiresIn,
    user: { id: result.user.id, email: result.user.email, role: result.user.role },
  };
}
