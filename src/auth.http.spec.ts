import { Controller, Get } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { SignJWT } from 'jose';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { ENVIRONMENT } from './config/environment.module.js';
import { PrismaService } from './infrastructure/database/prisma.service.js';
import { USER_STORE, AUTH_CLOCK } from './modules/auth/auth.tokens.js';
import type { UserStore } from './modules/auth/use-cases/ports/user-store.js';
import type { User } from './modules/auth/model/user.js';
import type { Actor } from './modules/auth/model/actor.js';
import { ScryptPasswords } from './modules/auth/diplomat/crypto/scrypt-passwords.js';
import { CurrentActor, Roles } from './modules/auth/diplomat/http/auth.decorators.js';

const secret = 'test-only-secret-with-at-least-32-bytes';
const start = new Date('2026-11-11T12:00:00.000Z');
const password = 'Test-only-password-123';
const unauthorized = { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required.' };

@Controller('auth-probe')
class ProtectedProbe {
  @Get()
  read(@CurrentActor() actor: Actor): { userId: string; role: string } {
    return { userId: actor.id, role: actor.role };
  }
  @Roles('ADMIN')
  @Get('admin')
  admin(): { allowed: boolean } {
    return { allowed: true };
  }
  @Roles('BASIC')
  @Get('basic')
  basic(): { allowed: boolean } {
    return { allowed: true };
  }
}

function accessToken(body: unknown): string {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('accessToken' in body) ||
    typeof body.accessToken !== 'string'
  )
    throw new Error('Missing access token.');
  return body.accessToken;
}

describe('Authentication HTTP contracts', () => {
  let app: INestApplication<Server>;
  let now = start;
  let users: User[];
  let storageUnavailable = false;
  const store: UserStore = {
    findByEmail: (email) => {
      if (storageUnavailable) return Promise.reject(new Error('Internal storage details'));
      return Promise.resolve(users.find((user) => user.email === email) ?? null);
    },
  };

  beforeAll(async () => {
    const passwords = new ScryptPasswords();
    users = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'admin@example.test',
        role: 'ADMIN',
        passwordHash: await passwords.hash(password),
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        email: 'buyer@example.test',
        role: 'BASIC',
        passwordHash: await passwords.hash(password),
      },
    ];
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedProbe],
    })
      .overrideProvider(ENVIRONMENT)
      .useValue({ authTokenSecret: secret })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(USER_STORE)
      .useValue(store)
      .overrideProvider(AUTH_CLOCK)
      .useValue({ now: () => now })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.init();
  });
  afterEach(() => {
    now = start;
    storageUnavailable = false;
  });
  afterAll(async () => {
    await app.close();
  });

  it('protects routes by default', async () => {
    await request(app.getHttpServer()).get('/auth-probe').expect(401).expect(unauthorized);
  });

  it.each([
    {},
    { email: 'invalid', password },
    { email: 'buyer@example.test', password, role: 'ADMIN' },
    { email: 'buyer@example.test', password: 123 },
  ])('rejects invalid login payloads without requiring a token', async (body) => {
    await request(app.getHttpServer()).post('/auth/login').send(body).expect(400);
  });

  it.each(['ADMIN', 'BASIC'])(
    'logs in %s and enforces its permissions using the issued token',
    async (role) => {
      const user = users.find((value) => value.role === role);
      if (!user) throw new Error('Missing user fixture.');
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ` ${user.email.toUpperCase()} `, password })
        .expect(200);
      const token = accessToken(response.body);
      expect(response.body).toEqual({
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: { id: user.id, email: user.email, role },
      });
      await request(app.getHttpServer())
        .get('/auth-probe')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect({ userId: user.id, role });
      await request(app.getHttpServer())
        .get(`/auth-probe/${role.toLowerCase()}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect({ allowed: true });
      await request(app.getHttpServer())
        .get(`/auth-probe/${role === 'ADMIN' ? 'basic' : 'admin'}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403)
        .expect({ statusCode: 403, code: 'FORBIDDEN', message: 'Insufficient permissions.' });
    },
  );

  it('returns the same error for unknown email and incorrect password', async () => {
    const expected = {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid email or password.',
    };
    for (const email of ['buyer@example.test', 'unknown@example.test']) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401)
        .expect(expected);
    }
  });

  it('accepts a token before expiry and rejects it at the exact expiry boundary', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'buyer@example.test', password })
      .expect(200);
    const token = accessToken(response.body);
    now = new Date(start.getTime() + 3599_000);
    await request(app.getHttpServer())
      .get('/auth-probe')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    now = new Date(start.getTime() + 3600_000);
    await request(app.getHttpServer())
      .get('/auth-probe')
      .set('Authorization', `Bearer ${token}`)
      .expect(401)
      .expect(unauthorized);
  });

  it.each(['Basic abc', 'Bearer malformed', 'Bearer a b'])(
    'rejects malformed authorization',
    async (header) => {
      await request(app.getHttpServer())
        .get('/auth-probe')
        .set('Authorization', header)
        .expect(401)
        .expect(unauthorized);
    },
  );

  it.each([
    'signature',
    'role',
    'subject',
    'issuer',
    'audience',
    'expiration',
    'algorithm',
    'future',
  ])('rejects invalid token %s', async (defect) => {
    const seconds = Math.floor(start.getTime() / 1000);
    let token = new SignJWT({ role: defect === 'role' ? 'SUPERADMIN' : 'ADMIN' })
      .setProtectedHeader({ alg: defect === 'algorithm' ? 'HS384' : 'HS256', typ: 'JWT' })
      .setSubject(defect === 'subject' ? 'not-a-uuid' : '11111111-1111-4111-8111-111111111111')
      .setIssuer(defect === 'issuer' ? 'another-issuer' : 'vehicle-auction-api')
      .setAudience(defect === 'audience' ? 'another-client' : 'vehicle-auction-client')
      .setIssuedAt(defect === 'future' ? seconds + 60 : seconds);
    if (defect !== 'expiration') token = token.setExpirationTime(seconds + 3600);
    const signed = await token.sign(
      new TextEncoder().encode(
        defect === 'signature' ? 'different-key-with-at-least-32-bytes' : secret,
      ),
    );
    await request(app.getHttpServer())
      .get('/auth-probe')
      .set('Authorization', `Bearer ${signed}`)
      .expect(401)
      .expect(unauthorized);
  });

  it('keeps unexpected storage failures generic', async () => {
    storageUnavailable = true;
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'buyer@example.test', password })
      .expect(500)
      .expect({ statusCode: 500, message: 'Internal server error' });
  });
});
