import type { Express } from 'express'
import request from 'supertest'
import { appWithAllRoutes, user } from '../testutils/appSetup'
import AuditService, { Page } from '../../services/auditService'
import MandatoryDrugTestingService from '../../services/mandatoryDrugTestingService'
import type { MdtListView } from '../../interfaces/mdtListView'
import type { HmppsUser } from '../../interfaces/hmppsUser'
import HmppsAuditClient from '../../data/hmppsAuditClient'
import MandatoryDrugTestingApiClient from '../../data/mandatoryDrugTestingApiClient'

jest.mock('../../services/auditService')
jest.mock('../../services/mandatoryDrugTestingService')

const auditService = new AuditService({} as HmppsAuditClient) as jest.Mocked<AuditService>
const mdtService = new MandatoryDrugTestingService(
  {} as MandatoryDrugTestingApiClient,
) as jest.Mocked<MandatoryDrugTestingService>

function view(overrides: Partial<MdtListView> = {}): MdtListView {
  return {
    caption: 'HMP Moorland',
    heading: 'September 2026',
    fallbackNotice: null,
    mainRows: [
      {
        entryId: 'm1',
        prisonerNumber: 'A0001AA',
        prisonerName: 'WEHNER, DAN',
        originalList: 'Main',
        location: 'RECP',
        locationSortKey: ['RECP'],
        releaseDate: 'No data available',
        releaseSortKey: Number.POSITIVE_INFINITY,
        lastSelectedMonth: 'Not tested before',
        lastSelectedSortKey: { group: 0, recencyMs: 0 },
        status: 'Not started',
        statusSortKey: 0,
        action: { kind: 'record-test', href: '/mdt-list/record/m1' },
        listSelectionNumber: 1,
      },
    ],
    reserveRows: [],
    summary: { completed: 3, releasingThisMonth: 1, testedOnWeekend: 2 },
    detailsMeta: { rows: [] },
    permissions: { canRecordTest: true, level: 'MANAGE' },
    emptyState: false,
    noReservesRemaining: false,
    ...overrides,
  }
}

let app: Express

const managerUser = {
  ...user,
  userRoles: ['MANDATORY_DRUG_TESTING_RW'],
  activeCaseLoadId: 'MDI',
  caseLoads: [{ caseLoadId: 'MDI', description: 'HMP Moorland', currentlyActive: true }],
} as unknown as HmppsUser

const readOnlyUser = {
  ...managerUser,
  userRoles: ['MANDATORY_DRUG_TESTING_RO'],
} as unknown as HmppsUser

const outsiderUser = {
  ...managerUser,
  userRoles: [],
} as unknown as HmppsUser

beforeEach(() => {
  app = appWithAllRoutes({
    services: { auditService, mandatoryDrugTestingService: mdtService },
    userSupplier: () => managerUser,
  })
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('GET /mdt-list', () => {
  it('renders the mdt list page for a manager', () => {
    auditService.logPageView.mockResolvedValue(undefined)
    mdtService.getMonthlyView.mockResolvedValue(view())

    return request(app)
      .get('/mdt-list')
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('HMP Moorland')
        expect(res.text).toContain('September 2026')
        expect(res.text).toContain('data-testid="mdt-main-table"')
        expect(res.text).toContain('data-testid="mdt-summary-completed"')
        expect(res.text).toContain('WEHNER, DAN')
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.MDT_LIST_PAGE, {
          who: managerUser.username,
          correlationId: expect.any(String),
        })
      })
  })

  it('renders the empty-state panel when both current and previous months 404', () => {
    auditService.logPageView.mockResolvedValue(undefined)
    mdtService.getMonthlyView.mockResolvedValue(
      view({
        emptyState: true,
        mainRows: [],
        reserveRows: [],
      }),
    )

    return request(app)
      .get('/mdt-list')
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('No lists currently exist for this prison')
        expect(res.text).not.toContain('data-testid="mdt-main-table"')
      })
  })

  it('renders 403 for users without any MDT role', () => {
    app = appWithAllRoutes({
      services: { auditService, mandatoryDrugTestingService: mdtService },
      userSupplier: () => outsiderUser,
    })

    return request(app).get('/mdt-list').expect(403)
  })

  it('read-only users see "No action needed" instead of Record test', () => {
    app = appWithAllRoutes({
      services: { auditService, mandatoryDrugTestingService: mdtService },
      userSupplier: () => readOnlyUser,
    })
    auditService.logPageView.mockResolvedValue(undefined)
    mdtService.getMonthlyView.mockResolvedValue(view({ permissions: { canRecordTest: false, level: 'VIEW_ONLY' } }))

    return request(app)
      .get('/mdt-list')
      .expect(200)
      .expect(res => {
        expect(res.text).not.toContain('data-testid="mdt-action-record-test"')
        expect(res.text).toContain('data-testid="mdt-action-no-action"')
      })
  })

  it('returns 500 when activeCaseLoadId is missing', () => {
    const badUser = { ...managerUser, activeCaseLoadId: undefined } as unknown as HmppsUser
    app = appWithAllRoutes({
      services: { auditService, mandatoryDrugTestingService: mdtService },
      userSupplier: () => badUser,
    })
    return request(app).get('/mdt-list').expect(500)
  })

  it('redirects GET / to /mdt-list', () => {
    return request(app).get('/').expect(302).expect('Location', '/mdt-list')
  })
})
