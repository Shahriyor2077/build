import { Request, Response, NextFunction } from 'express';
import { RoleName } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from '../lib/errors';
import { rolePermissionCache } from './auth';

/**
 * Load every role's permission set into memory once at boot. Cheap to keep in
 * process; invalidate by restarting or calling reloadPermissions() after an
 * admin changes the matrix.
 */
export async function reloadPermissions() {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
  });
  rolePermissionCache.clear();
  for (const role of roles) {
    rolePermissionCache.set(
      role.name,
      new Set(role.permissions.map((rp) => rp.permission.key)),
    );
  }
}

/** Require one of the given permission keys (SUPER_ADMIN bypasses). */
export const authorize =
  (...required: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role === RoleName.SUPER_ADMIN) return next();
    const ok = required.some((p) => req.user!.permissions.has(p));
    if (!ok) return next(forbidden(`Requires one of: ${required.join(', ')}`));
    next();
  };

/** Restrict a route to specific roles regardless of fine-grained permissions. */
export const requireRole =
  (...roles: RoleName[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
