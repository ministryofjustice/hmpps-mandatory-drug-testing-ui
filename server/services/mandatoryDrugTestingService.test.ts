import type MandatoryDrugTestingApiClient from '../data/mandatoryDrugTestingApiClient'
import MandatoryDrugTestingService from './mandatoryDrugTestingService'
import type { MonthlyTestingList, TestingListEntry } from '../interfaces/monthlyTestingList'
import type { TestedReason } from '../interfaces/testedReason'
import { InMemoryCache } from '../data/cache'

function entry(overrides: Partial<TestingListEntry> & { prisonerNumber?: string } = {}): TestingListEntry {
  const { prisonerNumber, ...rest } = overrides
  return {
    id: rest.id ?? 'e1',
    listId: 'L1',
    listType: rest.listType ?? 'M',
    testedStatus: rest.testedStatus ?? null,
    reasonNotTested: rest.reasonNotTested ?? null,
    listSelectionNumber: rest.listSelectionNumber ?? 1,
    sampleTakenDate: rest.sampleTakenDate ?? null,
    lastTestedDate: rest.lastTestedDate ?? null,
    prisoner: rest.prisoner ?? {
      prisonerNumber: prisonerNumber ?? 'A0001AA',
      firstName: 'DAN',
      lastName: 'WEHNER',
      cellLocation: 'RECP',
      releaseDate: null,
    },
    promoted: rest.promoted ?? null,
    notes: null,
  }
}

function list(overrides: Partial<MonthlyTestingList> = {}): MonthlyTestingList {
  return {
    id: 'L1',
    month: '2026-09',
    prisonLocation: 'MDI',
    mainList: overrides.mainList ?? [entry({ id: 'm1' })],
    reserveList: overrides.reserveList ?? [entry({ id: 'r1', listType: 'R', promoted: false })],
  }
}

function makeClient() {
  return {
    getMonthlyList: jest.fn(),
    getTestedReasons: jest.fn(),
  } as unknown as jest.Mocked<MandatoryDrugTestingApiClient>
}

describe('MandatoryDrugTestingService', () => {
  let client: jest.Mocked<MandatoryDrugTestingApiClient>
  let service: MandatoryDrugTestingService

  beforeEach(() => {
    client = makeClient()
    client.getTestedReasons.mockResolvedValue([
      { code: 'REFUSE', description: 'Refused a test' },
      { code: 'DISCH', description: 'Discharged' },
    ])
    service = new MandatoryDrugTestingService(client, new InMemoryCache<TestedReason[]>())
  })

  describe('getMonthlyView – happy path & shape', () => {
    it('renders caption, heading and populates main + reserve rows', async () => {
      client.getMonthlyList.mockResolvedValueOnce(list())
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP Moorland',
        viewerPermission: 'MANAGE',
      })
      expect(view.caption).toBe('HMP Moorland')
      expect(view.heading).toBe('September 2026')
      expect(view.fallbackNotice).toBeNull()
      expect(view.emptyState).toBe(false)
      expect(view.mainRows).toHaveLength(1)
      expect(view.reserveRows).toHaveLength(1)
      expect(view.mainRows[0].originalList).toBe('Main')
      expect(view.mainRows[0].prisonerName).toBe('WEHNER, DAN')
    })

    it('concatenates promoted reserves into mainRows with originalList = Reserve', async () => {
      client.getMonthlyList.mockResolvedValueOnce(
        list({
          mainList: [entry({ id: 'm1' })],
          reserveList: [
            entry({ id: 'r1', listType: 'R', promoted: false, listSelectionNumber: 1 }),
            entry({ id: 'r2', listType: 'R', promoted: true, listSelectionNumber: 2 }),
          ],
        }),
      )
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP Moorland',
        viewerPermission: 'MANAGE',
      })
      expect(view.mainRows.map(r => r.entryId)).toEqual(['m1', 'r2'])
      expect(view.mainRows[1].originalList).toBe('Reserve')
      // Reserve tab still shows both
      expect(view.reserveRows.map(r => r.entryId)).toEqual(['r1', 'r2'])
    })

    it('orders reserveRows by listSelectionNumber asc', async () => {
      client.getMonthlyList.mockResolvedValueOnce(
        list({
          reserveList: [
            entry({ id: 'r3', listType: 'R', listSelectionNumber: 3, promoted: false }),
            entry({ id: 'r1', listType: 'R', listSelectionNumber: 1, promoted: false }),
            entry({ id: 'r2', listType: 'R', listSelectionNumber: 2, promoted: false }),
          ],
        }),
      )
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP MDI',
        viewerPermission: 'VIEW_ONLY',
      })
      expect(view.reserveRows.map(r => r.order)).toEqual([1, 2, 3])
    })
  })

  describe('summary counts', () => {
    it('counts completed / releasing this month / tested on weekend', async () => {
      client.getMonthlyList.mockResolvedValueOnce(
        list({
          mainList: [
            // completed sample-taken, Saturday 2026-09-05
            entry({
              id: 'm1',
              testedStatus: true,
              sampleTakenDate: '2026-09-05',
              prisoner: {
                prisonerNumber: 'A0001AA',
                firstName: 'A',
                lastName: 'A',
                cellLocation: 'A-01',
                releaseDate: '2026-09-30',
              },
            }),
            // unable-to-test with Friday (not counted as completed, not weekend)
            entry({
              id: 'm2',
              testedStatus: false,
              reasonNotTested: 'REFUSE',
              sampleTakenDate: '2026-09-04',
              prisoner: {
                prisonerNumber: 'A0002AA',
                firstName: 'B',
                lastName: 'B',
                cellLocation: 'A-02',
                releaseDate: '2026-09-01',
              },
            }),
            // Not started, no weekend
            entry({
              id: 'm3',
              testedStatus: null,
              prisoner: {
                prisonerNumber: 'A0003AA',
                firstName: 'C',
                lastName: 'C',
                cellLocation: 'A-03',
                releaseDate: '2026-10-01',
              },
            }),
          ],
        }),
      )
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      expect(view.summary.completed).toBe(1)
      expect(view.summary.releasingThisMonth).toBe(2)
      expect(view.summary.testedOnWeekend).toBe(1)
      expect(view.summary.mainTotal).toBe(3)
      expect(view.summary.weekendTarget).toBe(1)
    })
  })

  describe('action rule', () => {
    async function actionFor(e: TestingListEntry, promotedReserves: TestingListEntry[] = []) {
      client.getMonthlyList.mockResolvedValueOnce(
        list({
          mainList: [e],
          reserveList: [entry({ id: 'unused', listType: 'R', promoted: false }), ...promotedReserves],
        }),
      )
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      return view.mainRows.find(r => r.entryId === e.id)!.action
    }

    it('testedStatus true → no-action', async () => {
      const action = await actionFor(entry({ id: 'e', testedStatus: true }))
      expect(action).toEqual({ kind: 'no-action' })
    })

    it('testedStatus false + REFUSE → replaced-by-reserve with adjudication href', async () => {
      const action = await actionFor(
        entry({ id: 'e', testedStatus: false, reasonNotTested: 'REFUSE', prisonerNumber: 'A1234BC' }),
      )
      expect(action.kind).toBe('replaced-by-reserve')
      if (action.kind === 'replaced-by-reserve') {
        expect(action.text).toBe('Replaced by reserve due to Refused a test')
        expect(action.href).toContain('A1234BC')
      }
    })

    it('testedStatus false + DISCH → replaced-by-reserve plain text (no href)', async () => {
      const action = await actionFor(entry({ id: 'e', testedStatus: false, reasonNotTested: 'DISCH' }))
      expect(action).toEqual({ kind: 'replaced-by-reserve', text: 'Replaced by reserve due to Discharged' })
    })

    it('Main + Not started → record-test link', async () => {
      const action = await actionFor(entry({ id: 'e', testedStatus: null }))
      expect(action.kind).toBe('record-test')
    })

    it('promoted reserve earliest-untested → record-test', async () => {
      // Main entry
      client.getMonthlyList.mockResolvedValueOnce(
        list({
          mainList: [entry({ id: 'm1', testedStatus: false, reasonNotTested: 'REFUSE' })],
          reserveList: [
            entry({ id: 'r1', listType: 'R', promoted: true, listSelectionNumber: 1 }),
            entry({ id: 'r2', listType: 'R', promoted: true, listSelectionNumber: 2 }),
          ],
        }),
      )
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      const r1 = view.mainRows.find(r => r.entryId === 'r1')!.action
      const r2 = view.mainRows.find(r => r.entryId === 'r2')!.action
      expect(r1.kind).toBe('record-test')
      expect(r2.kind).toBe('wait-for-previous-reserve')
    })
  })

  describe('404 fallback flow', () => {
    it('current-month 200 → returns list; no fallback', async () => {
      client.getMonthlyList.mockResolvedValueOnce(list())
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      expect(view.emptyState).toBe(false)
      expect(view.fallbackNotice).toBeNull()
      expect(client.getMonthlyList).toHaveBeenCalledTimes(1)
    })

    it('current 404 + previous 200 → renders previous month with fallback notice', async () => {
      client.getMonthlyList.mockResolvedValueOnce(null).mockResolvedValueOnce(list({ month: '2026-08' }))
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      expect(view.emptyState).toBe(false)
      expect(view.heading).toBe('August 2026')
      expect(view.fallbackNotice).toContain('September 2026')
      expect(view.fallbackNotice).toContain('August 2026')
      expect(client.getMonthlyList).toHaveBeenNthCalledWith(1, 'MDI', '2026-09')
      expect(client.getMonthlyList).toHaveBeenNthCalledWith(2, 'MDI', '2026-08')
    })

    it('both 404 → empty state view', async () => {
      client.getMonthlyList.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      expect(view.emptyState).toBe(true)
      expect(view.mainRows).toEqual([])
      expect(view.reserveRows).toEqual([])
    })

    it('current 5xx → rejects (no fallback attempted)', async () => {
      client.getMonthlyList.mockRejectedValueOnce(new Error('boom'))
      await expect(
        service.getMonthlyView({ prisonCode: 'MDI', listDate: '2026-09', caption: 'HMP', viewerPermission: 'MANAGE' }),
      ).rejects.toThrow('boom')
      expect(client.getMonthlyList).toHaveBeenCalledTimes(1)
    })

    it('previous-month rolls Dec → Nov', async () => {
      client.getMonthlyList.mockResolvedValueOnce(null).mockResolvedValueOnce(list({ month: '2026-11' }))
      await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-12',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      expect(client.getMonthlyList).toHaveBeenNthCalledWith(2, 'MDI', '2026-11')
    })

    it('previous-month rolls Jan → previous December', async () => {
      client.getMonthlyList.mockResolvedValueOnce(null).mockResolvedValueOnce(list({ month: '2026-12' }))
      await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2027-01',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      expect(client.getMonthlyList).toHaveBeenNthCalledWith(2, 'MDI', '2026-12')
    })
  })

  describe('reference-data cache', () => {
    it('caches results across calls within TTL', async () => {
      client.getMonthlyList.mockResolvedValue(list())
      await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      expect(client.getTestedReasons).toHaveBeenCalledTimes(1)
    })

    it('caches failure and falls back to raw code render', async () => {
      client.getTestedReasons.mockReset()
      client.getTestedReasons.mockRejectedValue(new Error('502'))
      client.getMonthlyList.mockResolvedValue(
        list({
          mainList: [entry({ id: 'm1', testedStatus: false, reasonNotTested: 'REFUSE', prisonerNumber: 'A9999AA' })],
        }),
      )
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      const { action } = view.mainRows[0]
      expect(action.kind).toBe('replaced-by-reserve')
      if (action.kind === 'replaced-by-reserve') {
        expect(action.text).toBe('Replaced by reserve due to REFUSE')
        expect(action.href).toContain('A9999AA') // adjudication link still applied for REFUSE
      }
      // second call re-uses failure cache
      await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      expect(client.getTestedReasons).toHaveBeenCalledTimes(1)
    })
  })

  describe('sort keys', () => {
    it('populates locationSortKey using natural-alphanumeric tokens', async () => {
      client.getMonthlyList.mockResolvedValueOnce(
        list({
          mainList: [
            entry({
              id: 'e',
              prisoner: {
                prisonerNumber: 'A0004AA',
                firstName: 'A',
                lastName: 'A',
                cellLocation: 'A-03-091',
                releaseDate: null,
              },
            }),
          ],
        }),
      )
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      expect(view.mainRows[0].locationSortKey).toEqual(['A-', 3, '-', 91])
    })

    it('releaseSortKey is +Infinity for null releaseDate', async () => {
      client.getMonthlyList.mockResolvedValueOnce(list())
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      expect(view.mainRows[0].releaseSortKey).toBe(Number.POSITIVE_INFINITY)
    })
  })

  describe('noReservesRemaining flag', () => {
    it('is true when every reserve is promoted', async () => {
      client.getMonthlyList.mockResolvedValueOnce(
        list({
          reserveList: [
            entry({ id: 'r1', listType: 'R', promoted: true, listSelectionNumber: 1 }),
            entry({ id: 'r2', listType: 'R', promoted: true, listSelectionNumber: 2 }),
          ],
        }),
      )
      const view = await service.getMonthlyView({
        prisonCode: 'MDI',
        listDate: '2026-09',
        caption: 'HMP',
        viewerPermission: 'MANAGE',
      })
      expect(view.noReservesRemaining).toBe(true)
    })
  })
})
