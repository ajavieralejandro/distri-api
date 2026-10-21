import { randomBytes, scrypt, timingSafeEqual } from 'crypto';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, SCRYPT_PARAMS, (error, derived) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const derived = await derive(password, salt);
  return `scrypt$${salt}$${derived.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, salt, hash] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const derived = await derive(password, salt);
  const expected = Buffer.from(hash, 'base64url');
  if (expected.length !== derived.length) {
    return false;
  }
  return timingSafeEqual(expected, derived);
}
