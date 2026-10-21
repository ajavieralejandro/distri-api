export type EnvironmentName = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: EnvironmentName;
  port: number;
  databaseUrl: string;
  corsOrigin: string | string[];
  jwtSecret: string;
  jwtAccessTtlSeconds: number;
  jwtRefreshTtlSeconds: number;
}

const VALID_NODE_ENVS: readonly EnvironmentName[] = [
  'development',
  'test',
  'production',
];

function requireString(config: Record<string, unknown>, key: string): string {
  const value = config[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Missing or invalid required environment variable: ${key}. ` +
        `Copy .env.example to .env and set a valid value.`,
    );
  }

  return value.trim();
}

function parsePort(raw: string): number {
  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT value "${raw}". Expected an integer between 1 and 65535.`,
    );
  }

  return port;
}

function parseNodeEnv(raw: string): EnvironmentName {
  if (!VALID_NODE_ENVS.includes(raw as EnvironmentName)) {
    throw new Error(
      `Invalid NODE_ENV value "${raw}". Expected one of: ${VALID_NODE_ENVS.join(', ')}.`,
    );
  }

  return raw as EnvironmentName;
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  key: string,
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `Invalid ${key} value "${raw}". Expected a positive integer.`,
    );
  }
  return value;
}

function parseJwtSecret(raw: string): string {
  if (raw.length < 32) {
    throw new Error(
      'Invalid JWT_SECRET. Expected a random string of at least 32 characters.',
    );
  }
  return raw;
}

function parseCorsOrigin(raw: string | undefined): string | string[] {
  if (!raw || raw.trim() === '' || raw.trim() === '*') {
    return '*';
  }

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    return '*';
  }

  return origins.length === 1 ? origins[0] : origins;
}

/**
 * Validates process environment at application bootstrap.
 * Fails fast with a clear message when required variables are missing.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = parseNodeEnv(requireString(config, 'NODE_ENV'));
  const port = parsePort(requireString(config, 'PORT'));
  const databaseUrl = requireString(config, 'DATABASE_URL');
  const jwtSecret = parseJwtSecret(requireString(config, 'JWT_SECRET'));
  const accessTtl = parsePositiveInt(
    typeof config.JWT_ACCESS_TTL_SECONDS === 'string'
      ? config.JWT_ACCESS_TTL_SECONDS
      : undefined,
    900,
    'JWT_ACCESS_TTL_SECONDS',
  );
  const refreshTtl = parsePositiveInt(
    typeof config.JWT_REFRESH_TTL_SECONDS === 'string'
      ? config.JWT_REFRESH_TTL_SECONDS
      : undefined,
    604800,
    'JWT_REFRESH_TTL_SECONDS',
  );
  const corsOrigin = parseCorsOrigin(
    typeof config.CORS_ORIGIN === 'string' ? config.CORS_ORIGIN : undefined,
  );

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_ACCESS_TTL_SECONDS: accessTtl,
    JWT_REFRESH_TTL_SECONDS: refreshTtl,
    CORS_ORIGIN: corsOrigin,
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV as EnvironmentName,
  port: Number(process.env.PORT),
  databaseUrl: process.env.DATABASE_URL as string,
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  jwtSecret: process.env.JWT_SECRET as string,
  jwtAccessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
  jwtRefreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 604800),
});
