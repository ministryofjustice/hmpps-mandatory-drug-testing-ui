import type { RequestHandler } from 'express'
import { UserPermissionLevel } from './userPermissionLevel'

const RO_ROLE = 'MANDATORY_DRUG_TESTING_RO'
const RW_ROLES = ['MANDATORY_DRUG_TESTING_RW', 'MANDATORY_DRUG_TESTING_RWU']

export default function populateUserPermissions(): RequestHandler {
  return (_req, res, next) => {
    const roles: string[] = res.locals?.user?.userRoles ?? []
    let permissions: UserPermissionLevel = UserPermissionLevel.FORBIDDEN
    if (roles.some(r => RW_ROLES.includes(r))) {
      permissions = UserPermissionLevel.MANAGE
    } else if (roles.includes(RO_ROLE)) {
      permissions = UserPermissionLevel.VIEW_ONLY
    }
    res.locals.permissions = permissions
    next()
  }
}
