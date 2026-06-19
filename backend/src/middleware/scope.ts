// Row-level security helpers. By default, non-privileged users see only records
// they own / are assigned. Privileged roles (admins, PM, finance) see all.
import { RoleName } from '@prisma/client';
import { AuthUser } from './auth';

const GLOBAL_VIEW: RoleName[] = [
  RoleName.SUPER_ADMIN,
  RoleName.CRM_ADMIN,
  RoleName.PROJECT_MANAGER,
  RoleName.FINANCE,
];

export const hasGlobalView = (user: AuthUser) => GLOBAL_VIEW.includes(user.role);

/**
 * Returns a Prisma `where` fragment scoping records to the user.
 * @param ownerField the FK column that denotes ownership (e.g. "ownerId", "agentId").
 */
export function scopeFilter(
  user: AuthUser,
  ownerField: string = 'ownerId',
): Record<string, unknown> {
  if (hasGlobalView(user)) return {};
  // Channel partners are scoped by their partner account, not user ownership.
  if (user.role === RoleName.CHANNEL_PARTNER) {
    return { channelPartnerId: user.partnerAccountId };
  }
  return { [ownerField]: user.id };
}

/** Throws-style guard: can this user act on a record with the given owner? */
export function canActOnOwned(user: AuthUser, ownerId: string): boolean {
  if (hasGlobalView(user)) return true;
  return ownerId === user.id;
}
