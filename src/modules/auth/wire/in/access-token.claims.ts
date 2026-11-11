export interface AccessTokenClaims {
  readonly sub: string;
  readonly role: 'ADMIN' | 'BASIC';
}
