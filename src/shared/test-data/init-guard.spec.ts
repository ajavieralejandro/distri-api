import {
  assertInitAuthorized,
  assertSeedAllowed,
  readSeedPassword,
  redactSecrets,
} from './init-guard';

const localUrl =
  'postgresql://distrisoft:distrisoft@127.0.0.1:5433/distrisoft_test';

describe('test data guards', () => {
  it('keeps the seed from running in production or against an unnamed remote', () => {
    expect(() =>
      assertSeedAllowed({
        NODE_ENV: 'production',
        DATABASE_URL: localUrl,
      }),
    ).toThrow(/NODE_ENV=production/);

    expect(() =>
      assertSeedAllowed({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://app:secret@db.example:5432/distrisoft_test',
      }),
    ).toThrow(/SEED_CONFIRM=yes/);

    expect(
      assertSeedAllowed({ NODE_ENV: 'development', DATABASE_URL: localUrl }),
    ).toEqual({ host: '127.0.0.1', database: 'distrisoft_test' });
  });

  it('requires an explicit database name and a second flag in production', () => {
    expect(() => assertInitAuthorized({ DATABASE_URL: localUrl })).toThrow(
      /INIT_TEST_DATA=yes/,
    );
    expect(() =>
      assertInitAuthorized({
        INIT_TEST_DATA: 'yes',
        DATABASE_URL: localUrl,
        INIT_TEST_DATABASE_NAME: 'otra_base',
      }),
    ).toThrow(/INIT_TEST_DATABASE_NAME/);
    expect(() =>
      assertInitAuthorized({
        NODE_ENV: 'production',
        INIT_TEST_DATA: 'yes',
        DATABASE_URL: localUrl,
        INIT_TEST_DATABASE_NAME: 'distrisoft_test',
      }),
    ).toThrow(/INIT_TEST_ALLOW_PRODUCTION=yes/);

    expect(
      assertInitAuthorized({
        NODE_ENV: 'production',
        INIT_TEST_DATA: 'yes',
        INIT_TEST_ALLOW_PRODUCTION: 'yes',
        DATABASE_URL: localUrl,
        INIT_TEST_DATABASE_NAME: 'distrisoft_test',
      }),
    ).toEqual({ host: '127.0.0.1', database: 'distrisoft_test' });
  });

  it('rejects a placeholder password and hides the database URL', () => {
    expect(() =>
      readSeedPassword({ SEED_PASSWORD: 'replace-with-a-test-password' }),
    ).toThrow(/SEED_PASSWORD/);
    expect(readSeedPassword({ SEED_PASSWORD: 'secreta-prueba' })).toBe(
      'secreta-prueba',
    );
    expect(
      redactSecrets(`falló ${localUrl} con clave distrisoft`, localUrl),
    ).toBe('falló postgresql://*** con clave ***');
  });
});
