import type { Role } from '@prisma/client';

export type AuthenticatedUser = {
  userId: string;
  sessionId: string;
  role: Role;
  commerceId: string | null;
  displayName: string;
  email: string;
};
