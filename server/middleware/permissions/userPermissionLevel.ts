export type UserPermissionLevel = 'VIEW_ONLY' | 'MANAGE' | 'FORBIDDEN'

export const UserPermissionLevel = {
  VIEW_ONLY: 'VIEW_ONLY' as const,
  MANAGE: 'MANAGE' as const,
  FORBIDDEN: 'FORBIDDEN' as const,
}
