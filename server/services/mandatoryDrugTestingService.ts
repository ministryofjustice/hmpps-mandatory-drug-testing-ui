import type MandatoryDrugTestingApiClient from '../data/mandatoryDrugTestingApiClient'
import type { TestingListEntry } from '../interfaces/monthlyTestingList'
import type { TestedReason } from '../interfaces/testedReason'
import type {
  DetailsMeta,
  MainAction,
  MainListViewRow,
  MdtListView,
  ReserveListViewRow,
  SummaryCounts,
} from '../interfaces/mdtListView'
import type { UserPermissionLevel } from '../middleware/permissions/userPermissionLevel'
import type { CacheInterface } from '../data/cache'
import { toNaturalKey } from './utils/naturalAlphanumericCompare'
import config from '../config'
import logger from '../../logger'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const REFUSE_REASON_CODE = 'REFUSE'
const REASON_CACHE_KEY = 'mdt:testedReasons'
const REASON_CACHE_TTL_SECONDS = 5 * 60

function formatReleaseDate(iso: string | null): string {
  if (!iso) return 'No data available'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'No data available'
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = MONTH_NAMES[date.getUTCMonth()].slice(0, 3)
  const year = date.getUTCFullYear()
  return `${day} ${month} ${year}`
}

function formatMonthYear(month: string): string {
  const [yStr, mStr] = month.split('-')
  const monthIndex = parseInt(mStr, 10) - 1
  if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return month
  return `${MONTH_NAMES[monthIndex]} ${yStr}`
}

function formatLastSelectedMonth(iso: string | null): string {
  if (!iso) return 'Not tested before'
  const [yStr, mStr] = iso.split('-')
  const monthIndex = parseInt(mStr, 10) - 1
  if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return 'Not tested before'
  return `${MONTH_NAMES[monthIndex]} ${yStr}`
}

function previousMonth(listDate: string): string {
  const [yStr, mStr] = listDate.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

function isSameYearMonth(iso: string, listMonth: string): boolean {
  if (!iso) return false
  return iso.substring(0, 7) === listMonth
}

function isWeekend(iso: string | null): boolean {
  if (!iso) return false
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return false
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

export default class MandatoryDrugTestingService {
  constructor(
    private readonly apiClient: MandatoryDrugTestingApiClient,
    private readonly reasonCache: CacheInterface<TestedReason[]>,
  ) {}

  async getMonthlyView({
    prisonCode,
    listDate,
    caption,
    viewerPermission,
  }: {
    prisonCode: string
    listDate: string
    caption: string
    viewerPermission: UserPermissionLevel
  }): Promise<MdtListView> {
    let list = await this.apiClient.getMonthlyList(prisonCode, listDate)
    let fallbackNotice: string | null = null
    let effectiveMonth = listDate

    if (!list) {
      const prev = previousMonth(listDate)
      const prevList = await this.apiClient.getMonthlyList(prisonCode, prev)
      if (!prevList) {
        return this.emptyStateView(caption, listDate, viewerPermission)
      }
      list = prevList
      fallbackNotice = `No list exists for ${formatMonthYear(listDate)} yet — showing ${formatMonthYear(prev)}.`
      effectiveMonth = prev
    }

    if (!list.mainList?.length || !list.reserveList?.length) {
      logger.error(
        `MDT API contract breach: empty mainList or reserveList in 200 response for ${prisonCode}/${effectiveMonth}`,
      )
      throw new Error('MDT API returned an empty list')
    }

    const reasons = await this.getTestedReasonsCached()

    const promotedReserves = list.reserveList.filter(r => r.promoted === true)

    const rawMainRows: Array<{ entry: TestingListEntry; originalList: 'Main' | 'Reserve' }> = [
      ...list.mainList.map(e => ({ entry: e, originalList: 'Main' as const })),
      ...promotedReserves.map(e => ({ entry: e, originalList: 'Reserve' as const })),
    ]

    // Earliest untested promoted-reserve (for the "Test previous reserve first" rule)
    const untestedPromoted = promotedReserves.filter(r => r.testedStatus === null)
    const earliestPromotedUntested =
      untestedPromoted.length > 0
        ? Math.min(...untestedPromoted.map(r => r.listSelectionNumber))
        : Number.POSITIVE_INFINITY

    const mainRows: MainListViewRow[] = rawMainRows.map(({ entry, originalList }) =>
      this.shapeMainRow(entry, originalList, earliestPromotedUntested, reasons),
    )

    const reserveRows: ReserveListViewRow[] = [...list.reserveList]
      .sort((a, b) => a.listSelectionNumber - b.listSelectionNumber)
      .map(entry => this.shapeReserveRow(entry))

    const summary = this.buildSummary(mainRows, list.mainList, list.reserveList, effectiveMonth)
    const detailsMeta = this.buildDetailsMeta()
    const noReservesRemaining = list.reserveList.length > 0 && list.reserveList.every(r => r.promoted === true)

    return {
      caption,
      heading: formatMonthYear(effectiveMonth),
      fallbackNotice,
      mainRows,
      reserveRows,
      summary,
      detailsMeta,
      permissions: {
        canRecordTest: viewerPermission === 'MANAGE',
        level: viewerPermission,
      },
      emptyState: false,
      noReservesRemaining,
    }
  }

  private emptyStateView(caption: string, listDate: string, viewerPermission: UserPermissionLevel): MdtListView {
    return {
      caption,
      heading: formatMonthYear(listDate),
      fallbackNotice: null,
      mainRows: [],
      reserveRows: [],
      summary: {
        completed: 0,
        mainTotal: 0,
        releasingThisMonth: 0,
        testedOnWeekend: 0,
        weekendTarget: 0,
        reserve: { reservesUsed: 0, reserveTotal: 0, releasingThisMonth: 0 },
      },
      detailsMeta: { rows: [] },
      permissions: {
        canRecordTest: viewerPermission === 'MANAGE',
        level: viewerPermission,
      },
      emptyState: true,
      noReservesRemaining: false,
    }
  }

  private shapeMainRow(
    entry: TestingListEntry,
    originalList: 'Main' | 'Reserve',
    earliestPromotedUntested: number,
    reasons: Map<string, TestedReason> | null,
  ): MainListViewRow {
    const prisonerName = `${entry.prisoner.lastName}, ${entry.prisoner.firstName}`
    const releaseDateIso = entry.prisoner.releaseDate
    const releaseDate = formatReleaseDate(releaseDateIso)
    const releaseSortKey = releaseDateIso ? new Date(`${releaseDateIso}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY

    let status: MainListViewRow['status']
    let statusSortKey: 0 | 1 | 2
    if (entry.testedStatus === null) {
      status = 'Not started'
      statusSortKey = 0
    } else if (entry.testedStatus === true) {
      status = 'Sample taken'
      statusSortKey = 1
    } else {
      status = 'Unable to test'
      statusSortKey = 2
    }

    const lastSelectedMonth = formatLastSelectedMonth(entry.lastTestedDate)
    let group: 0 | 1 | 2 = 0
    let recencyMs = 0
    if (entry.lastTestedDate) {
      recencyMs = new Date(`${entry.lastTestedDate}T00:00:00Z`).getTime()
      group = statusSortKey === 2 ? 2 : 1
    }

    return {
      entryId: entry.id,
      prisonerNumber: entry.prisoner.prisonerNumber,
      prisonerName,
      originalList,
      location: entry.prisoner.cellLocation,
      locationSortKey: toNaturalKey(entry.prisoner.cellLocation),
      releaseDate,
      releaseSortKey,
      lastSelectedMonth,
      lastSelectedSortKey: { group, recencyMs },
      status,
      statusSortKey,
      action: this.computeAction(entry, originalList, earliestPromotedUntested, reasons),
      listSelectionNumber: entry.listSelectionNumber,
    }
  }

  private shapeReserveRow(entry: TestingListEntry): ReserveListViewRow {
    return {
      entryId: entry.id,
      order: entry.listSelectionNumber,
      prisonerNumber: entry.prisoner.prisonerNumber,
      prisonerName: `${entry.prisoner.lastName}, ${entry.prisoner.firstName}`,
      location: entry.prisoner.cellLocation,
      lastSelectedMonth: formatLastSelectedMonth(entry.lastTestedDate),
      status: entry.promoted === true ? 'Moved to main list' : 'Available as reserve',
    }
  }

  private computeAction(
    entry: TestingListEntry,
    originalList: 'Main' | 'Reserve',
    earliestPromotedUntested: number,
    reasons: Map<string, TestedReason> | null,
  ): MainAction {
    if (entry.testedStatus === true) return { kind: 'no-action' }

    if (entry.testedStatus === false) {
      const code = entry.reasonNotTested ?? ''
      const description = reasons?.get(code)?.description ?? code
      const text = `Replaced by reserve due to ${description}`
      if (code === REFUSE_REASON_CODE) {
        const href = config.manageAdjudications.urlTemplate.replace('{prisonerNumber}', entry.prisoner.prisonerNumber)
        return { kind: 'replaced-by-reserve', text, href }
      }
      return { kind: 'replaced-by-reserve', text }
    }

    // testedStatus === null → "Not started"
    if (originalList === 'Main') {
      return { kind: 'record-test', href: `/mdt-list/record/${entry.id}` }
    }

    // Reserve entry that was promoted to main
    if (entry.listSelectionNumber === earliestPromotedUntested) {
      return { kind: 'record-test', href: `/mdt-list/record/${entry.id}` }
    }
    return { kind: 'wait-for-previous-reserve' }
  }

  private buildSummary(
    mainRows: MainListViewRow[],
    mainListEntries: TestingListEntry[],
    reserveListEntries: TestingListEntry[],
    listMonth: string,
  ): SummaryCounts {
    // Build a map of entryId → underlying entry for weekend/release lookups
    const entryById = new Map<string, TestingListEntry>()
    for (const e of mainListEntries) entryById.set(e.id, e)
    for (const e of reserveListEntries) entryById.set(e.id, e)

    let completed = 0
    let releasing = 0
    let weekend = 0
    for (const row of mainRows) {
      const entry = entryById.get(row.entryId)
      if (entry) {
        if (entry.testedStatus === true) completed += 1
        if (entry.prisoner.releaseDate && isSameYearMonth(entry.prisoner.releaseDate, listMonth)) {
          releasing += 1
        }
        if (isWeekend(entry.sampleTakenDate)) {
          weekend += 1
        }
      }
    }
    let reservesUsed = 0
    let reserveReleasing = 0
    for (const r of reserveListEntries) {
      if (r.promoted === true) reservesUsed += 1
      if (r.prisoner.releaseDate && isSameYearMonth(r.prisoner.releaseDate, listMonth)) {
        reserveReleasing += 1
      }
    }

    return {
      completed,
      mainTotal: mainListEntries.length,
      releasingThisMonth: releasing,
      testedOnWeekend: weekend,
      weekendTarget: Math.ceil(mainListEntries.length * 0.14),
      reserve: {
        reservesUsed,
        reserveTotal: reserveListEntries.length,
        releasingThisMonth: reserveReleasing,
      },
    }
  }

  private buildDetailsMeta(): DetailsMeta {
    return {
      rows: [
        { label: 'List generated on', value: '—' },
        { label: 'Generated by', value: '—' },
        { label: 'Average monthly population', value: '—' },
        { label: 'Percentage of population requested', value: '—' },
        { label: 'Reserve list size', value: '—' },
        { label: 'Selection reference', value: '—' },
      ],
    }
  }

  async getTestedReasonsCached(): Promise<Map<string, TestedReason> | null> {
    const cached = await this.reasonCache.get(REASON_CACHE_KEY)
    if (cached) {
      return cached.length === 0 ? null : new Map(cached.map(reason => [reason.code, reason]))
    }

    try {
      const list = await this.apiClient.getTestedReasons()
      await this.reasonCache.set(REASON_CACHE_KEY, list, REASON_CACHE_TTL_SECONDS)
      return list.length === 0 ? null : new Map(list.map(reason => [reason.code, reason]))
    } catch (error) {
      logger.warn(`Tested reasons endpoint failed: ${(error as Error).message}. Caching failure for TTL.`)
      await this.reasonCache.set(REASON_CACHE_KEY, [], REASON_CACHE_TTL_SECONDS)
      return null
    }
  }
}

export { formatMonthYear, previousMonth, isWeekend, isSameYearMonth, MONTH_NAMES }
