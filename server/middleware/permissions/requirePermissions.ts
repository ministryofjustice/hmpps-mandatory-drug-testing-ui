import type { RequestHandler } from 'express'
import logger from '../../../logger'
import type { UserPermissionLevel } from './userPermissionLevel'

export default function requirePermissions(...allowed: UserPermissionLevel[]): RequestHandler {
  return (_req, res, next) => {
    const permission = res.locals?.permissions as UserPermissionLevel | undefined
    if (!permission) {
      logger.error('requirePermissions used before populateUserPermissions middleware')
      res.status(500).render('pages/error')
      return
    }
    if (permission === 'FORBIDDEN' || !allowed.includes(permission)) {
      res.status(403).render('pages/notAuthorised')
      return
    }
    next()
  }
}
