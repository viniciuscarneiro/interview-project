import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { ENVIRONMENT } from './config/environment.module.js';
import type { Environment } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<INestApplication<Server>>(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  const environment = app.get<Environment>(ENVIRONMENT);
  await app.listen(environment.port, environment.host);
}

bootstrap().catch(() => {
  Logger.error('Application startup failed. Check configuration and available ports.', 'Bootstrap');
  process.exitCode = 1;
});
