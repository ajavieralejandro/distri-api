import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to ADMIN and/or COMMERCE.
 * JwtAuthGuard populates `request.user` and RolesGuard enforces this list.
 *
 * @example @Roles('ADMIN')
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
