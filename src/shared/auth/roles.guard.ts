import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import type { Request } from 'express';

import { ROLES_KEY } from './roles.decorator';

type AuthenticatedRequest = Request & { user?: { role: Role } };

/**
 * Scaffolding only — not wired globally and not applied to any route yet.
 * Once a real auth strategy populates `request.user`, apply this guard
 * (e.g. `@UseGuards(RolesGuard)`) alongside `@Roles(...)` to restrict a
 * route to ADMIN and/or COMMERCE. Until then it has no effect: a route
 * without `@Roles(...)` stays open, matching current behavior.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return Boolean(request.user && requiredRoles.includes(request.user.role));
  }
}
