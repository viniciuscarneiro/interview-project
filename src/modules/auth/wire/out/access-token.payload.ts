export interface AccessTokenPayload {
  readonly sub: string;
  readonly role: 'ADMIN' | 'BASIC';
}
