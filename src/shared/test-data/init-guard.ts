export type GuardEnv = {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  SEED_CONFIRM?: string;
  SEED_PASSWORD?: string;
  INIT_TEST_DATA?: string;
  INIT_TEST_DATABASE_NAME?: string;
  INIT_TEST_ALLOW_PRODUCTION?: string;
};

export type DatabaseTarget = {
  host: string;
  database: string;
};

export function databaseTarget(databaseUrl: string): DatabaseTarget {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL no es una URL válida.');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) {
    throw new Error('DATABASE_URL no indica el nombre de la base.');
  }
  return { host: url.hostname, database };
}

/** Gate for `npm run prisma:seed`. Production stays refused. */
export function assertSeedAllowed(env: GuardEnv): DatabaseTarget {
  if (env.NODE_ENV === 'production') {
    throw new Error('No se cargan datos de prueba cuando NODE_ENV=production.');
  }
  if (!env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL.');
  }
  const target = databaseTarget(env.DATABASE_URL);
  const local = target.host === 'localhost' || target.host === '127.0.0.1';
  if (!local && env.SEED_CONFIRM !== 'yes') {
    throw new Error(
      'Para sembrar una base que no es local, definí SEED_CONFIRM=yes.',
    );
  }
  return target;
}

/**
 * Separate gate for `npm run test-data:init`.
 * It can run while NODE_ENV=production only when the operator names the
 * destination database and sets INIT_TEST_ALLOW_PRODUCTION=yes.
 */
export function assertInitAuthorized(env: GuardEnv): DatabaseTarget {
  if (env.INIT_TEST_DATA !== 'yes') {
    throw new Error(
      'Definí INIT_TEST_DATA=yes para inicializar los datos de prueba.',
    );
  }
  if (!env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL.');
  }
  const target = databaseTarget(env.DATABASE_URL);
  if (env.INIT_TEST_DATABASE_NAME !== target.database) {
    throw new Error(
      'INIT_TEST_DATABASE_NAME tiene que ser exactamente el nombre de la base de DATABASE_URL.',
    );
  }
  if (
    env.NODE_ENV === 'production' &&
    env.INIT_TEST_ALLOW_PRODUCTION !== 'yes'
  ) {
    throw new Error(
      'Con NODE_ENV=production hace falta INIT_TEST_ALLOW_PRODUCTION=yes.',
    );
  }
  return target;
}

export function readSeedPassword(env: GuardEnv): string {
  const password = env.SEED_PASSWORD?.trim() ?? '';
  if (password.length < 8 || password.startsWith('replace-with-')) {
    throw new Error(
      'Definí SEED_PASSWORD con una contraseña de prueba de al menos 8 caracteres.',
    );
  }
  return password;
}

export function redactSecrets(message: string, databaseUrl?: string): string {
  let redacted = message;
  if (!databaseUrl) {
    return redacted;
  }
  redacted = redacted.split(databaseUrl).join('postgresql://***');
  try {
    const password = new URL(databaseUrl).password;
    if (password) {
      redacted = redacted.split(decodeURIComponent(password)).join('***');
    }
  } catch {
    return redacted;
  }
  return redacted;
}
