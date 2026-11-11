import { assertTestDatabase } from '../support/test-database.js';

describe('Test database cleanup safety', () => {
  const previous = process.env;
  afterEach(() => {
    process.env = previous;
  });

  it.each([
    'postgresql://user:password@127.0.0.1:55432/interview_dev?schema=public',
    'postgresql://user:password@remote.example:55433/interview_test?schema=public',
    'postgresql://user:password@127.0.0.1:55433/interview_test?schema=other',
  ])('refuses unsafe cleanup targets', (url) => {
    process.env = { ...previous, NODE_ENV: 'test', DATABASE_URL: url, TEST_DATABASE_URL: url };
    expect(assertTestDatabase).toThrow('Refusing data cleanup');
  });

  it('refuses cleanup outside test mode even with a valid target', () => {
    process.env = { ...previous, NODE_ENV: 'development' };
    expect(assertTestDatabase).toThrow('Refusing data cleanup');
  });
});
