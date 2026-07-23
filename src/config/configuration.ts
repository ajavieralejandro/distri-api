export type EnvironmentName = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: EnvironmentName;
  port: number;
  databaseUrl: string;
  corsOrigin: string | string[];
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
  const corsOrigin = parseCorsOrigin(
    typeof config.CORS_ORIGIN === 'string' ? config.CORS_ORIGIN : undefined,
  );

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl,
    CORS_ORIGIN: corsOrigin,
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV as EnvironmentName,
  port: Number(process.env.PORT),
  databaseUrl: process.env.DATABASE_URL as string,
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
});
