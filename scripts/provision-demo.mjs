import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { readEnvironment } from '../dist/config/environment.js';
import { readDemoPasswords } from '../dist/config/demo-accounts.js';
import { DemoAccountsCli } from '../dist/modules/auth/diplomat/cli/demo-accounts.cli.js';

async function main() {
  process.chdir(fileURLToPath(new URL('..', import.meta.url)));
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--test'))
    throw new Error('Use auth:seed with optional --test.');
  const test = args[0] === '--test';
  loadEnvFile(test ? '.env.test' : '.env');
  if (test) {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';
  }
  const environment = readEnvironment(process.env);
  const passwords = readDemoPasswords(environment, process.env);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    await app.get(DemoAccountsCli).execute(passwords);
    console.log(
      'Demo accounts ready: admin@example.test (ADMIN), buyer@example.test (BASIC). Existing passwords are unchanged.',
    );
  } finally {
    await app.close();
  }
}
main().catch(() => {
  console.error(
    'Demo provisioning failed. Check the local target, required environment variables, migrations, and account conflicts.',
  );
  process.exitCode = 1;
});
