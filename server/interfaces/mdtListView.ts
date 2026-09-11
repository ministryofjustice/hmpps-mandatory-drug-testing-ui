import type { UserPermissionLevel } from '../middleware/permissions/userPermissionLevel'

export interface ReserveSummaryCounts {
  reservesUsed: number
  reserveTotal: number
  releasingThisMonth: number
}

export interface SummaryCounts {
  completed: number
  mainTotal: number
  releasingThisMonth: number
  testedOnWeekend: number
  weekendTarget: number
  reserve: ReserveSummaryCounts
}

export type LastSelectedSortKey = { group: 0 | 1 | 2; recencyMs: number }

export type MainAction =
  | { kind: 'record-test'; href: string }
  | { kind: 'no-action' }
  | { kind: 'replaced-by-reserve'; text: string; href?: string }
  | { kind: 'wait-for-previous-reserve' }

export interface MainListViewRow {
  entryId: string
  prisonerNumber: string
  prisonerName: string
  originalList: 'Main' | 'Reserve'
  location: string
  locationSortKey: Array<string | number>
  releaseDate: string
  releaseSortKey: number
  lastSelectedMonth: string
  lastSelectedSortKey: LastSelectedSortKey
  status: 'Not started' | 'Sample taken' | 'Unable to test'
  statusSortKey: 0 | 1 | 2
  action: MainAction
  listSelectionNumber: number
}

export interface ReserveListViewRow {
  entryId: string
  order: number
  prisonerNumber: string
  prisonerName: string
  location: string
  lastSelectedMonth: string
  status: 'Available as reserve' | 'Moved to main list'
}

export interface DetailsMetaRow {
  label: string
  value: string
  pending?: boolean
}

export interface DetailsMeta {
  rows: DetailsMetaRow[]
}

export interface MdtListView {
  caption: string
  heading: string
  fallbackNotice: string | null
  mainRows: MainListViewRow[]
  reserveRows: ReserveListViewRow[]
  summary: SummaryCounts
  detailsMeta: DetailsMeta
  permissions: { canRecordTest: boolean; level: UserPermissionLevel }
  emptyState: boolean
  noReservesRemaining: boolean
}
