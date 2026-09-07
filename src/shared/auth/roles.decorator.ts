import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Marks a route as restricted to one or more of the two canonical profiles
 * (ADMIN | COMMERCE). Requires RolesGuard to be applied on the route and a
 * real auth strategy populating `request.user` — neither exists yet at this
 * stage; this decorator is scaffolding for when auth lands.
 *
 * @example @Roles('ADMIN')
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
