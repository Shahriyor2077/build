import { Request, Response, NextFunction } from 'express';
import { RoleName } from '@prisma/client';
import { verifyAccessToken } from '../lib/jwt';
import { unauthorized } from '../lib/errors';

export interface AuthUser {
  id: string;
  role: RoleName;
  partnerAccountId?: string | null;
  permissions: Set<string>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// In-process permission cache keyed by role, populated by rbac loader at boot.
export const rolePermissionCache = new Map<RoleName, Set<string>>();

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized('Missing bearer token'));
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    const role = payload.role as RoleName;
    req.user = {
      id: payload.sub,
      role,
      partnerAccountId: payload.partnerAccountId ?? null,
      permissions: rolePermissionCache.get(role) ?? new Set(),
    };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}
