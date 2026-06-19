import { Router } from 'express';
import { z } from 'zod';
import { AuditAction, Prisma, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/async';
import { authorize, reloadPermissions } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { writeAudit } from '../middleware/audit';
import { listQuerySchema, paginate, pageMeta } from '../lib/http';
import { badRequest, conflict, notFound } from '../lib/errors';

const router = Router();

const roleNameEnum = z.enum([
  'SUPER_ADMIN',
  'CRM_ADMIN',
  'SALES_AGENT',
  'CHANNEL_PARTNER',
  'PROJECT_MANAGER',
  'FINANCE',
]);

const userSelect: Prisma.UserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  timezone: true,
  partnerAccountId: true,
  role: { select: { id: true, name: true, label: true } },
  createdAt: true,
  lastLoginAt: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

// GET /users — list users with their role.
router.get(
  '/users',
  authorize('admin.users'),
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as never as z.infer<typeof listQuerySchema>;
    const where: Prisma.UserWhereInput = q.q
      ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }] }
      : {};
    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, ...paginate(q), orderBy: { createdAt: 'desc' }, select: userSelect }),
      prisma.user.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(total, q) });
  }),
);

const createUserBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  roleName: roleNameEnum,
  partnerAccountId: z.string().uuid().optional(),
});

// POST /users — create a user (password hashed with bcryptjs).
router.post(
  '/users',
  authorize('admin.users'),
  validate({ body: createUserBody }),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof createUserBody>;
    const existing = await prisma.user.findUnique({ where: { email: b.email } });
    if (existing) throw conflict('A user with this email already exists');

    const role = await prisma.role.findUnique({ where: { name: b.roleName as RoleName } });
    if (!role) throw badRequest(`Unknown role: ${b.roleName}`);

    const user = await prisma.user.create({
      data: {
        name: b.name,
        email: b.email,
        phone: b.phone,
        passwordHash: bcrypt.hashSync(b.password, 10),
        roleId: role.id,
        partnerAccountId: b.partnerAccountId,
      },
      select: userSelect,
    });
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      module: 'admin',
      entity: 'User',
      entityId: user.id,
      newValue: user,
    });
    res.status(201).json(user);
  }),
);

const updateUserBody = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  roleName: roleNameEnum.optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().optional(),
});

// PATCH /users/:id — update profile / role / status.
router.patch(
  '/users/:id',
  authorize('admin.users'),
  validate({ body: updateUserBody }),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof updateUserBody>;
    const before = await prisma.user.findUnique({ where: { id: req.params.id }, select: userSelect });
    if (!before) throw notFound('User not found');

    let roleId: string | undefined;
    if (b.roleName) {
      const role = await prisma.role.findUnique({ where: { name: b.roleName as RoleName } });
      if (!role) throw badRequest(`Unknown role: ${b.roleName}`);
      roleId = role.id;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        name: b.name,
        phone: b.phone,
        isActive: b.isActive,
        timezone: b.timezone,
        roleId,
      },
      select: userSelect,
    });
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      module: 'admin',
      entity: 'User',
      entityId: user.id,
      oldValue: before,
      newValue: user,
    });
    res.json(user);
  }),
);

// POST /users/:id/deactivate — disable a user.
router.post(
  '/users/:id/deactivate',
  authorize('admin.users'),
  asyncHandler(async (req, res) => {
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) throw notFound('User not found');
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
      select: userSelect,
    });
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      module: 'admin',
      entity: 'User',
      entityId: user.id,
      oldValue: { isActive: before.isActive },
      newValue: { isActive: false },
    });
    res.json(user);
  }),
);

// POST /users/:id/reset-password — rehash a new password.
router.post(
  '/users/:id/reset-password',
  authorize('admin.users'),
  validate({ body: z.object({ password: z.string().min(8) }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) throw notFound('User not found');
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash: bcrypt.hashSync((req.body as { password: string }).password, 10) },
    });
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      module: 'admin',
      entity: 'User',
      entityId: req.params.id,
      newValue: { passwordReset: true },
    });
    res.json({ ok: true });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// ROLES & PERMISSIONS
// ─────────────────────────────────────────────────────────────────────────────

// GET /roles — roles with their permission keys.
router.get(
  '/roles',
  authorize('admin.roles'),
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });
    const data = roles.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      description: r.description,
      permissionKeys: r.permissions.map((rp) => rp.permission.key),
    }));
    res.json({ data });
  }),
);

// GET /permissions — the full permission catalogue.
router.get(
  '/permissions',
  authorize('admin.roles'),
  asyncHandler(async (_req, res) => {
    const permissions = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }] });
    res.json({ data: permissions });
  }),
);

// PUT /roles/:id/permissions — replace a role's permission set (transaction),
// then reload the in-memory permission cache so the change takes effect.
router.put(
  '/roles/:id/permissions',
  authorize('admin.roles'),
  validate({ body: z.object({ permissionKeys: z.array(z.string()) }) }),
  asyncHandler(async (req, res) => {
    const role = await prisma.role.findUnique({ where: { id: req.params.id } });
    if (!role) throw notFound('Role not found');
    const { permissionKeys } = req.body as { permissionKeys: string[] };

    const perms = await prisma.permission.findMany({ where: { key: { in: permissionKeys } }, select: { id: true, key: true } });
    const found = new Set(perms.map((p) => p.key));
    const missing = permissionKeys.filter((k) => !found.has(k));
    if (missing.length) throw badRequest(`Unknown permission keys: ${missing.join(', ')}`);

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      }),
    ]);

    // Refresh the in-memory role→permission cache used by the rbac middleware.
    await reloadPermissions();

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      module: 'admin',
      entity: 'Role',
      entityId: role.id,
      newValue: { permissionKeys },
    });
    res.json({ ok: true, roleId: role.id, permissionKeys });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────────────────

// GET /audit-logs — searchable, paginated, newest first.
router.get(
  '/audit-logs',
  authorize('admin.audit'),
  validate({
    query: listQuerySchema.extend({
      userId: z.string().uuid().optional(),
      module: z.string().optional(),
      entity: z.string().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.query as never as z.infer<typeof listQuerySchema> & {
      userId?: string;
      module?: string;
      entity?: string;
      from?: Date;
      to?: Date;
    };
    const createdAt =
      q.from || q.to ? { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } : undefined;
    const where: Prisma.AuditLogWhereInput = {
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.module ? { module: q.module } : {}),
      ...(q.entity ? { entity: q.entity } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        ...paginate(q),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(total, q) });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM CONFIG
// ─────────────────────────────────────────────────────────────────────────────

// GET /config — all SystemConfig as a key → value map.
router.get(
  '/config',
  authorize('admin.config'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.systemConfig.findMany();
    const data: Record<string, unknown> = {};
    for (const r of rows) data[r.key] = r.value;
    res.json({ data });
  }),
);

// PUT /config — upsert a single SystemConfig row.
router.put(
  '/config',
  authorize('admin.config'),
  validate({ body: z.object({ key: z.string().min(1), value: z.unknown() }) }),
  asyncHandler(async (req, res) => {
    const { key, value } = req.body as { key: string; value: unknown };
    const before = await prisma.systemConfig.findUnique({ where: { key } });
    const config = await prisma.systemConfig.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    await writeAudit({
      userId: req.user!.id,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      module: 'admin',
      entity: 'SystemConfig',
      entityId: key,
      oldValue: before ?? undefined,
      newValue: config,
    });
    res.json(config);
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

// GET /templates — list notification templates.
router.get(
  '/templates',
  authorize('admin.templates'),
  asyncHandler(async (_req, res) => {
    const templates = await prisma.notificationTemplate.findMany({ orderBy: { key: 'asc' } });
    res.json({ data: templates });
  }),
);

const templateBody = z.object({
  key: z.string().min(1),
  channel: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
});

// POST /templates — create or update a template (keyed by `key`).
router.post(
  '/templates',
  authorize('admin.templates'),
  validate({ body: templateBody }),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof templateBody>;
    const before = await prisma.notificationTemplate.findUnique({ where: { key: b.key } });
    const template = await prisma.notificationTemplate.upsert({
      where: { key: b.key },
      create: { key: b.key, channel: b.channel, subject: b.subject, body: b.body },
      update: { channel: b.channel, subject: b.subject, body: b.body },
    });
    await writeAudit({
      userId: req.user!.id,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      module: 'admin',
      entity: 'NotificationTemplate',
      entityId: template.id,
      oldValue: before ?? undefined,
      newValue: template,
    });
    res.status(before ? 200 : 201).json(template);
  }),
);

export default router;
