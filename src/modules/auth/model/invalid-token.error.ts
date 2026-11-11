export class InvalidTokenError extends Error {
  constructor() {
    super('Invalid access token.');
  }
}
