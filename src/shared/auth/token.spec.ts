import { signAccessToken, verifyAccessToken } from './token';

const SECRET = 'test-secret-test-secret-test-secret';

describe('access tokens', () => {
  it('accepts a token signed with the same secret', () => {
    const token = signAccessToken(
      { sub: 'user-1', sid: 'session-1' },
      SECRET,
      60,
      1_000,
    );

    expect(verifyAccessToken(token, SECRET, 1_010)).toEqual({
      sub: 'user-1',
      sid: 'session-1',
    });
  });

  it('rejects a tampered token, a wrong secret and an expired token', () => {
    const token = signAccessToken(
      { sub: 'user-1', sid: 'session-1' },
      SECRET,
      60,
      1_000,
    );
    const [header, payload, signature] = token.split('.');

    expect(verifyAccessToken(`${header}.${payload}.aaaa`, SECRET, 1_010)).toBe(
      null,
    );
    expect(
      verifyAccessToken(
        `${header}.${payload}.${signature}`,
        'other-secret-other-secret-other',
        1_010,
      ),
    ).toBe(null);
    expect(verifyAccessToken(token, SECRET, 1_060)).toBeNull();
  });
});
