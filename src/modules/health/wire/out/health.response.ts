export interface LivenessResponse {
  readonly status: 'ok';
}
export interface ReadinessResponse {
  readonly status: 'ok' | 'error';
  readonly checks: { readonly database: 'up' | 'down' };
}
