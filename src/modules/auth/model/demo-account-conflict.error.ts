export class DemoAccountConflictError extends Error {
  constructor() {
    super('Demo account conflicts with an existing user.');
  }
}
