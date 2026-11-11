import { readDemoPasswords } from './demo-accounts.js';
import type { Environment } from './environment.js';

const environment: Environment = {
  nodeEnv: 'development',
  host: '127.0.0.1',
  port: 3100,
  databaseUrl: 'postgresql://local:local@127.0.0.1:55432/interview_dev?schema=public',
  authTokenSecret: 'test-only-secret-with-at-least-32-bytes',
};
const values = {
  DEMO_ADMIN_PASSWORD: 'test-admin-password',
  DEMO_BUYER_PASSWORD: 'test-buyer-password',
};

describe('Local demo provisioning boundary', () => {
  it('accepts explicit passwords only for the dedicated local target', () => {
    expect(readDemoPasswords(environment, values)).toEqual({
      admin: values.DEMO_ADMIN_PASSWORD,
      buyer: values.DEMO_BUYER_PASSWORD,
    });
  });
  it.each([
    { ...environment, nodeEnv: 'production' as const },
    {
      ...environment,
      databaseUrl: 'postgresql://local:local@remote.example:55432/interview_dev?schema=public',
    },
    {
      ...environment,
      databaseUrl: 'postgresql://local:local@127.0.0.1:55432/another_database?schema=public',
    },
    { ...environment, nodeEnv: 'test' as const },
  ])('refuses unsafe provisioning without exposing credentials', (unsafe) => {
    expect(() => readDemoPasswords(unsafe, values)).toThrow(
      'Demo accounts require the dedicated local development or test database.',
    );
  });
  it('requires explicit passwords and does not put them in errors', () => {
    expect(() =>
      readDemoPasswords(environment, { ...values, DEMO_ADMIN_PASSWORD: 'secret' }),
    ).toThrow('DEMO_ADMIN_PASSWORD and DEMO_BUYER_PASSWORD must contain 12 to 256 characters.');
    expect(() => readDemoPasswords(environment, {})).toThrow('must contain');
  });
});
