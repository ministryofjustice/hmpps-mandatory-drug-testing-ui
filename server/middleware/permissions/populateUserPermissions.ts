import type { RequestHandler } from 'express'
import type { UserPermissionLevel } from './userPermissionLevel'

const RO_ROLE = 'MANDATORY_DRUG_TESTING_RO'
const RW_ROLES = ['MANDATORY_DRUG_TESTING_RW', 'MANDATORY_DRUG_TESTING_RWU']

export default function populateUserPermissions(): RequestHandler {
  return (_req, res, next) => {
    const roles: string[] = res.locals?.user?.userRoles ?? []
    let permissions: UserPermissionLevel = 'FORBIDDEN'
    if (roles.some(r => RW_ROLES.includes(r))) {
      permissions = 'MANAGE'
    } else if (roles.includes(RO_ROLE)) {
      permissions = 'VIEW_ONLY'
    }
    res.locals.permissions = permissions
    next()
  }
}
