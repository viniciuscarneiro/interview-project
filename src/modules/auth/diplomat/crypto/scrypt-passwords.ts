import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Passwords } from '../../use-cases/ports/passwords.js';
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}
export class ScryptPasswords implements Passwords {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt);
    return `scrypt-v1$${salt.toString('hex')}$${key.toString('hex')}`;
  }
  async verify(password: string, hash: string | null): Promise<boolean> {
    const match = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(
      hash ?? `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`,
    );
    const salt = match?.[1];
    const expected = match?.[2];
    if (!salt || !expected) throw new Error('Unsupported password hash.');
    const actual = await derive(password, Buffer.from(salt, 'hex'));
    const valid = timingSafeEqual(actual, Buffer.from(expected, 'hex'));
    return hash !== null && valid;
  }
}
