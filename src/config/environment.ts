export interface Environment {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
}

export function readEnvironment(values: NodeJS.ProcessEnv): Environment {
  const nodeEnv = values['NODE_ENV'] ?? 'development';
  if (nodeEnv !== 'development' && nodeEnv !== 'test' && nodeEnv !== 'production') {
    throw new Error('NODE_ENV must be development, test, or production.');
  }
  const port = Number(values['PORT'] ?? '3100');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const databaseUrl = values['DATABASE_URL'];
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !url.hostname ||
    url.pathname === '/'
  ) {
    throw new Error('DATABASE_URL must identify a PostgreSQL host and database.');
  }
  return { nodeEnv, port, host: values['HOST'] ?? '127.0.0.1', databaseUrl };
}
