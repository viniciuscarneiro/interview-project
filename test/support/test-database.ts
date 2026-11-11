export function assertTestDatabase(): void {
  const value = process.env['DATABASE_URL'];
  if (process.env['NODE_ENV'] !== 'test' || !value || value !== process.env['TEST_DATABASE_URL']) {
    throw new Error('Refusing data cleanup outside the dedicated test environment.');
  }
  const url = new URL(value);
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '55433' ||
    url.pathname !== '/interview_test' ||
    url.search !== '?schema=public'
  ) {
    throw new Error('Refusing data cleanup outside the local interview_test database.');
  }
}
