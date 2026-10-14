import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Role } from '@prisma/client';

import { AppException } from '../../shared/errors/app.exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { verifyPassword } from '../../shared/auth/password';
import {
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../../shared/auth/token';
import { PrismaService } from '../../shared/prisma/prisma.service';

export type PublicUser = {
  userId: string;
  role: Role;
  displayName: string;
  email: string;
  commerceId: string | null;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

const INVALID_CREDENTIALS = 'El email o la contraseña no son válidos.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ tokens: TokenPair; user: PublicUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppException(
        INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
      );
    }

    if (user.role === 'COMMERCE' && !user.commerceId) {
      throw new AppException(
        'El usuario no está vinculado a un comercio.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    return this.issueSession(user.id);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const currentHash = hashRefreshToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: currentHash },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new AppException(
        'La sesión no es válida o venció.',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
      );
    }

    const next = createRefreshToken();
    const expiresAt = new Date(Date.now() + this.refreshTtlSeconds() * 1000);
    const rotated = await this.prisma.session.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: currentHash,
        revokedAt: null,
      },
      data: { refreshTokenHash: next.hash, expiresAt },
    });
    if (rotated.count !== 1) {
      throw new AppException(
        'La sesión no es válida o venció.',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
      );
    }

    return this.tokensFor(session.userId, session.id, next.token);
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppException(
        'La sesión no es válida o venció.',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
      );
    }
    return this.toPublicUser(user);
  }

  private async issueSession(userId: string): Promise<{
    tokens: TokenPair;
    user: PublicUser;
  }> {
    const refresh = createRefreshToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: refresh.hash,
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds() * 1000),
      },
      include: { user: true },
    });
    return {
      tokens: this.tokensFor(userId, session.id, refresh.token),
      user: this.toPublicUser(session.user),
    };
  }

  private tokensFor(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ): TokenPair {
    const accessTtl = this.configService.getOrThrow<number>(
      'jwtAccessTtlSeconds',
    );
    return {
      accessToken: signAccessToken(
        { sub: userId, sid: sessionId },
        this.configService.getOrThrow<string>('jwtSecret'),
        accessTtl,
      ),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessTtl,
    };
  }

  private refreshTtlSeconds(): number {
    return this.configService.getOrThrow<number>('jwtRefreshTtlSeconds');
  }

  private toPublicUser(user: {
    id: string;
    role: Role;
    displayName: string;
    email: string;
    commerceId: string | null;
  }): PublicUser {
    return {
      userId: user.id,
      role: user.role,
      displayName: user.displayName,
      email: user.email,
      commerceId: user.commerceId,
    };
  }
}
