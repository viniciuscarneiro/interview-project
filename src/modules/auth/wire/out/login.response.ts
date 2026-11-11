export interface LoginResponse {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly user: { readonly id: string; readonly email: string; readonly role: 'ADMIN' | 'BASIC' };
}
