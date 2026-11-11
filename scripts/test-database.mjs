import { loadEnvFile } from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
loadEnvFile('.env.test');
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error('TEST_DATABASE_URL is required.');
const url = new URL(connectionString);
if (
  url.protocol !== 'postgresql:' ||
  url.hostname !== '127.0.0.1' ||
  url.port !== '55433' ||
  url.pathname !== '/interview_test' ||
  url.search !== '?schema=public'
) {
  throw new Error('Refusing database tests: use the dedicated local interview_test database.');
}

const projects = process.argv.slice(2);
if (!projects.length || projects.some((name) => !['integration', 'e2e'].includes(name))) {
  throw new Error('Choose integration and/or e2e.');
}
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: connectionString };
function run(script, args, flags = []) {
  const result = spawnSync(process.execPath, [...flags, script, ...args], {
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('node_modules/prisma/build/index.js', ['generate']);
run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
run(
  'node_modules/jest/bin/jest.js',
  ['--runInBand', '--selectProjects', ...projects],
  ['--experimental-vm-modules'],
);
