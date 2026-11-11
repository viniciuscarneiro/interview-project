import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import { ENVIRONMENT } from '../../src/config/environment.module.js';
import { readEnvironment } from '../../src/config/environment.js';

export async function createTestApp(
  options: { databaseUrl?: string } = {},
): Promise<INestApplication<Server>> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.databaseUrl) {
    builder.overrideProvider(ENVIRONMENT).useValue({
      ...readEnvironment(process.env),
      databaseUrl: options.databaseUrl,
    });
  }
  const module = await builder.compile();
  const app = module.createNestApplication<INestApplication<Server>>({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}
