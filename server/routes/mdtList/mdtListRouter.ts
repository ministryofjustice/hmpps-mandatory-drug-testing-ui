import { Router } from 'express'
import requirePermissions from '../../middleware/permissions/requirePermissions'
import MdtListController from './mdtListController'
import type { Services } from '../../services'

export default function mdtListRouter(services: Services): Router {
  const router = Router({ mergeParams: true })
  const controller = new MdtListController(services.mandatoryDrugTestingService, services.auditService)

  router.get('/', requirePermissions('VIEW_ONLY', 'MANAGE'), (req, res, next) => controller.get(req, res, next))

  return router
}
