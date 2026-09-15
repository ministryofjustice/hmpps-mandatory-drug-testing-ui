import type { UserPermissionLevel } from '../middleware/permissions/userPermissionLevel'

const LEVELS: Record<UserPermissionLevel, number> = {
  FORBIDDEN: 0,
  VIEW_ONLY: 1,
  MANAGE: 2,
}

/**
 * Nunjucks filter: `{{ permissions | hasPermission('MANAGE') }}`.
 * Returns true when the viewer's permission level is at least the required level.
 */
export default function hasPermissionFilter(
  actual: UserPermissionLevel | undefined,
  required: UserPermissionLevel,
): boolean {
  if (!actual) return false
  return LEVELS[actual] >= LEVELS[required]
}
