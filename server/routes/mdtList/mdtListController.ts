import type { NextFunction, Request, Response } from 'express'
import type MandatoryDrugTestingService from '../../services/mandatoryDrugTestingService'
import type AuditService from '../../services/auditService'
import { Page } from '../../services/auditService'
import type { UserPermissionLevel } from '../../middleware/permissions/userPermissionLevel'
import logger from '../../../logger'

export default class MdtListController {
  constructor(
    private readonly mdtService: MandatoryDrugTestingService,
    private readonly auditService: AuditService,
  ) {}

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = res.locals.user as {
        username: string
        activeCaseLoad?: { caseLoadId: string; description: string }
      }
      const activeCaseLoadId = user?.activeCaseLoad.caseLoadId
      if (!activeCaseLoadId) {
        logger.error('MDT list requested but activeCaseLoadId is missing on res.locals.user')
        res.status(500).render('pages/error')
        return
      }
      const caption = user.activeCaseLoad.description

      const now = new Date()
      const listDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

      const view = await this.mdtService.getMonthlyView({
        prisonCode: activeCaseLoadId,
        listDate,
        caption,
        viewerPermission: (res.locals.permissions as UserPermissionLevel) ?? 'VIEW_ONLY',
      })

      await this.auditService.logPageView(Page.MDT_LIST_PAGE, {
        who: user.username,
        correlationId: req.id,
      })

      res.render('pages/mdtList/index', { view })
    } catch (error) {
      next(error)
    }
  }
}
