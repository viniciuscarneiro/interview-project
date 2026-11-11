import type { Environment } from './environment.js';

export interface DemoPasswords {
  readonly admin: string;
  readonly buyer: string;
}

export function readDemoPasswords(
  environment: Environment,
  values: NodeJS.ProcessEnv,
): DemoPasswords {
  const url = new URL(environment.databaseUrl);
  const development =
    environment.nodeEnv === 'development' &&
    url.port === '55432' &&
    url.pathname === '/interview_dev';
  const test =
    environment.nodeEnv === 'test' &&
    url.port === '55433' &&
    url.pathname === '/interview_test' &&
    environment.databaseUrl === values['TEST_DATABASE_URL'];
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    url.search !== '?schema=public' ||
    (!development && !test)
  ) {
    throw new Error('Demo accounts require the dedicated local development or test database.');
  }
  const admin = values['DEMO_ADMIN_PASSWORD'];
  const buyer = values['DEMO_BUYER_PASSWORD'];
  if (!admin || !buyer || [admin, buyer].some((value) => value.length < 12 || value.length > 256)) {
    throw new Error(
      'DEMO_ADMIN_PASSWORD and DEMO_BUYER_PASSWORD must contain 12 to 256 characters.',
    );
  }
  return { admin, buyer };
}
