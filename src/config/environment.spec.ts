import { readEnvironment } from './environment.js';

const authTokenSecret = 'test-only-secret-with-at-least-32-bytes';
const databaseUrl = 'postgresql://user:password@127.0.0.1:55432/interview_dev';

describe('Environment boundary', () => {
  it('produces typed local defaults from valid input', () => {
    expect(
      readEnvironment({ DATABASE_URL: databaseUrl, AUTH_TOKEN_SECRET: authTokenSecret }),
    ).toEqual({
      databaseUrl,
      authTokenSecret,
      nodeEnv: 'development',
      host: '127.0.0.1',
      port: 3100,
    });
  });
  it.each(['abc', '0', '65536', '1.5'])('rejects invalid port %s', (port) => {
    expect(() => readEnvironment({ DATABASE_URL: databaseUrl, PORT: port })).toThrow('PORT must');
  });
  it.each([undefined, 'short'])('rejects missing or short token signing secrets', (secret) => {
    expect(() => readEnvironment({ DATABASE_URL: databaseUrl, AUTH_TOKEN_SECRET: secret })).toThrow(
      'AUTH_TOKEN_SECRET',
    );
  });
  it('requires an explicit database URL', () => {
    expect(() => readEnvironment({})).toThrow('DATABASE_URL is required.');
  });
  it('does not expose the invalid database URL in errors', () => {
    expect(() =>
      readEnvironment({ DATABASE_URL: 'https://secret:password@example.com/db' }),
    ).toThrow('DATABASE_URL must identify a PostgreSQL host and database.');
  });
  it('rejects unknown environments', () => {
    expect(() => readEnvironment({ DATABASE_URL: databaseUrl, NODE_ENV: 'typo' })).toThrow(
      'NODE_ENV must',
    );
  });
});
