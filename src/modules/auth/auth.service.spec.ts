import { ConfigService } from '@nestjs/config';

import { hashPassword } from '../../shared/auth/password';
import { verifyAccessToken } from '../../shared/auth/token';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthService } from './auth.service';

const SECRET = 'test-secret-test-secret-test-secret';

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: 'ADMIN' | 'COMMERCE';
  commerceId: string | null;
};

type SessionRow = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: UserRow;
};

describe('AuthService', () => {
  const users: UserRow[] = [];
  const sessions: SessionRow[] = [];
  let sequence = 0;

  const prisma = {
    user: {
      findUnique: ({ where }: { where: { email?: string; id?: string } }) => {
        const found = users.find(
          (user) => user.email === where.email || user.id === where.id,
        );
        return Promise.resolve(found ?? null);
      },
    },
    session: {
      create: ({
        data,
        include,
      }: {
        data: {
          userId: string;
          refreshTokenHash: string;
          expiresAt: Date;
        };
        include?: { user: boolean };
      }) => {
        const user = users.find((candidate) => candidate.id === data.userId);
        if (!user) {
          throw new Error('missing user');
        }
        const row: SessionRow = {
          id: `session-${++sequence}`,
          userId: data.userId,
          refreshTokenHash: data.refreshTokenHash,
          expiresAt: data.expiresAt,
          revokedAt: null,
          user,
        };
        sessions.push(row);
        return Promise.resolve(include?.user ? row : row);
      },
      findUnique: ({
        where,
      }: {
        where: { refreshTokenHash?: string; id?: string };
      }) =>
        Promise.resolve(
          sessions.find(
            (session) =>
              session.refreshTokenHash === where.refreshTokenHash ||
              session.id === where.id,
          ) ?? null,
        ),
      updateMany: ({
        where,
        data,
      }: {
        where: { id: string; refreshTokenHash?: string; revokedAt: null };
        data: { refreshTokenHash?: string; expiresAt?: Date; revokedAt?: Date };
      }) => {
        const session = sessions.find(
          (candidate) =>
            candidate.id === where.id &&
            (where.refreshTokenHash === undefined ||
              candidate.refreshTokenHash === where.refreshTokenHash) &&
            candidate.revokedAt === null,
        );
        if (!session) {
          return Promise.resolve({ count: 0 });
        }
        if (data.refreshTokenHash) {
          session.refreshTokenHash = data.refreshTokenHash;
        }
        if (data.expiresAt) {
          session.expiresAt = data.expiresAt;
        }
        if (data.revokedAt) {
          session.revokedAt = data.revokedAt;
        }
        return Promise.resolve({ count: 1 });
      },
    },
  } as unknown as PrismaService;

  const config = {
    getOrThrow: (key: string) => {
      if (key === 'jwtSecret') {
        return SECRET;
      }
      if (key === 'jwtAccessTtlSeconds') {
        return 900;
      }
      if (key === 'jwtRefreshTtlSeconds') {
        return 3600;
      }
      throw new Error(key);
    },
  } as unknown as ConfigService;

  const service = new AuthService(prisma, config);

  beforeEach(() => {
    users.splice(0, users.length);
    sessions.splice(0, sessions.length);
    sequence = 0;
  });

  it('returns the commerce linked in the database, not a client-supplied id', async () => {
    users.push({
      id: 'user-norte',
      email: 'norte@pruebas.distrisoft.local',
      displayName: 'Almacén Norte',
      passwordHash: await hashPassword('secreta-prueba'),
      role: 'COMMERCE',
      commerceId: 'com-norte',
    });

    const result = await service.login(
      'Norte@pruebas.distrisoft.local',
      'secreta-prueba',
    );

    expect(result.user).toEqual({
      userId: 'user-norte',
      role: 'COMMERCE',
      displayName: 'Almacén Norte',
      email: 'norte@pruebas.distrisoft.local',
      commerceId: 'com-norte',
    });
    expect(result.tokens.tokenType).toBe('Bearer');
    expect(verifyAccessToken(result.tokens.accessToken, SECRET)?.sub).toBe(
      'user-norte',
    );
  });

  it('rejects an unknown user and a commerce account without a commerce', async () => {
    await expect(
      service.login('nadie@pruebas.distrisoft.local', 'secreta-prueba'),
    ).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' });

    users.push({
      id: 'user-suelto',
      email: 'suelto@pruebas.distrisoft.local',
      displayName: 'Sin comercio',
      passwordHash: await hashPassword('secreta-prueba'),
      role: 'COMMERCE',
      commerceId: null,
    });

    await expect(
      service.login('suelto@pruebas.distrisoft.local', 'secreta-prueba'),
    ).rejects.toMatchObject({ errorCode: 'FORBIDDEN' });
  });

  it('rotates the refresh token and logout makes the old session unusable', async () => {
    users.push({
      id: 'user-admin',
      email: 'admin@pruebas.distrisoft.local',
      displayName: 'Admin',
      passwordHash: await hashPassword('secreta-prueba'),
      role: 'ADMIN',
      commerceId: null,
    });
    const login = await service.login(
      'admin@pruebas.distrisoft.local',
      'secreta-prueba',
    );
    const refreshed = await service.refresh(login.tokens.refreshToken);

    expect(refreshed.refreshToken).not.toBe(login.tokens.refreshToken);
    await expect(
      service.refresh(login.tokens.refreshToken),
    ).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' });

    const sessionId = verifyAccessToken(refreshed.accessToken, SECRET)?.sid;
    expect(sessionId).toBeTruthy();
    await service.logout(sessionId as string);
    await expect(service.refresh(refreshed.refreshToken)).rejects.toMatchObject(
      { errorCode: 'UNAUTHORIZED' },
    );
  });
});
