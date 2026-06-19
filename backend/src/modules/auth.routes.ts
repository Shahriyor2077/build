import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AuditAction } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../lib/jwt';
import { env } from '../config/env';
import { asyncHandler } from '../middleware/async';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { writeAudit } from '../middleware/audit';
import { unauthorized } from '../lib/errors';

const router = Router();

const REFRESH_DAYS = 7;
const refreshExpiry = () => new Date(Date.now() + REFRESH_DAYS * 24 * 3600 * 1000);

async function issueTokens(user: { id: string; roleName: string; partnerAccountId: string | null }) {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.roleName,
    partnerAccountId: user.partnerAccountId,
  });
  const refreshToken = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiry() },
  });
  return { accessToken, refreshToken };
}

// POST /api/auth/login
router.post(
  '/login',
  validate({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
    if (!user || !user.isActive) throw unauthorized('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw unauthorized('Invalid credentials');

    const tokens = await issueTokens({
      id: user.id,
      roleName: user.role.name,
      partnerAccountId: user.partnerAccountId,
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit({ userId: user.id, action: AuditAction.LOGIN, module: 'auth', entity: 'User', entityId: user.id, ip: req.ip });

    res.json({
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role.name },
    });
  }),
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  validate({ body: z.object({ refreshToken: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw unauthorized('Invalid refresh token');
    }
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw unauthorized('Refresh token expired or revoked');
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { role: true } });
    if (!user || !user.isActive) throw unauthorized();

    // Rotate: revoke old, issue new.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const tokens = await issueTokens({
      id: user.id,
      roleName: user.role.name,
      partnerAccountId: user.partnerAccountId,
    });
    res.json(tokens);
  }),
);

// POST /api/auth/logout
router.post(
  '/logout',
  validate({ body: z.object({ refreshToken: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    if (req.body.refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(req.body.refreshToken) },
        data: { revokedAt: new Date() },
      });
    }
    res.json({ ok: true });
  }),
);

// GET /api/auth/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { role: true },
    });
    if (!user) throw unauthorized();
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role.name,
      roleLabel: user.role.label,
      timezone: user.timezone,
      partnerAccountId: user.partnerAccountId,
      permissions: [...(req.user!.permissions ?? [])],
    });
  }),
);

export default router;
