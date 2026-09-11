// Client-side sort for the MDT main list.
// Reads the row dataset embedded as JSON, sorts the tbody rows in place,
// updates aria-sort on the active header, and persists across tab switches
// via module scope (resets on page reload).

interface SortKeyRow {
  entryId: string
  prisonerName: string
  originalList: 'Main' | 'Reserve'
  locationSortKey: Array<string | number>
  releaseSortKey: number
  lastSelectedSortKey: { group: number; recencyMs: number }
  statusSortKey: number
}

type SortField = 'prisoner' | 'originalList' | 'location' | 'release' | 'lastSelected' | 'status'
type SortDir = 'ascending' | 'descending'

interface SortState {
  field: SortField | null
  dir: SortDir
}

const HEADER_FIELDS: Record<number, SortField> = {
  0: 'prisoner',
  1: 'originalList',
  2: 'location',
  3: 'release',
  4: 'lastSelected',
  5: 'status',
}

function readDataset(): SortKeyRow[] {
  const el = document.getElementById('mdt-list-data')
  if (!el) return []
  try {
    return JSON.parse(el.textContent || '[]') as SortKeyRow[]
  } catch {
    return []
  }
}

function compareNaturalKey(a: Array<string | number>, b: Array<string | number>): number {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    const va = a[i]
    const vb = b[i]
    if (typeof va === 'number' && typeof vb === 'number') {
      if (va !== vb) return va - vb
    } else if (typeof va === 'string' && typeof vb === 'string') {
      const cmp = va.localeCompare(vb, 'en-GB', { sensitivity: 'base' })
      if (cmp !== 0) return cmp
    } else {
      return typeof va === 'number' ? -1 : 1
    }
  }
  return a.length - b.length
}

function compareBy(field: SortField, a: SortKeyRow, b: SortKeyRow): number {
  switch (field) {
    case 'prisoner':
      return a.prisonerName.localeCompare(b.prisonerName, undefined, { sensitivity: 'base' })
    case 'originalList':
      return a.originalList.localeCompare(b.originalList)
    case 'location':
      return compareNaturalKey(a.locationSortKey, b.locationSortKey)
    case 'release':
      return a.releaseSortKey - b.releaseSortKey
    case 'lastSelected': {
      const g = a.lastSelectedSortKey.group - b.lastSelectedSortKey.group
      if (g !== 0) return g
      return a.lastSelectedSortKey.recencyMs - b.lastSelectedSortKey.recencyMs
    }
    case 'status':
      return a.statusSortKey - b.statusSortKey
    default:
      return 0
  }
}

const state: SortState = { field: null, dir: 'ascending' }

function applySort(table: HTMLTableElement, dataset: SortKeyRow[]) {
  if (!state.field) return
  const rows = dataset.slice().sort((a, b) => compareBy(state.field!, a, b))
  if (state.dir === 'descending') rows.reverse()

  const tbody = table.tBodies[0]
  if (!tbody) return
  const rowById = new Map<string, HTMLTableRowElement>()
  Array.from(tbody.rows).forEach(row => {
    const id = row.getAttribute('data-entry-id')
    if (id) rowById.set(id, row)
  })
  for (const row of rows) {
    const rowEl = rowById.get(row.entryId)
    if (rowEl) tbody.appendChild(rowEl)
  }

  const headers = table.tHead?.rows[0]?.cells
  if (headers) {
    for (let i = 0; i < headers.length; i += 1) {
      const header = headers[i]
      const field = HEADER_FIELDS[i]
      if (field) {
        header.setAttribute('aria-sort', field === state.field ? state.dir : 'none')
      }
    }
  }
}

export default function initMdtSort(): void {
  const table = document.querySelector<HTMLTableElement>('[data-testid="mdt-main-table"]')
  if (!table) return
  const dataset = readDataset()

  const headers = table.tHead?.rows[0]?.cells
  if (!headers) return
  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i]
    const field = HEADER_FIELDS[i]
    if (!field) {
      // eslint-disable-next-line no-continue
      continue
    }
    header.setAttribute('role', 'button')
    header.setAttribute('tabindex', '0')
    const activate = () => {
      if (state.field === field) {
        state.dir = state.dir === 'ascending' ? 'descending' : 'ascending'
      } else {
        state.field = field
        state.dir = 'ascending'
      }
      applySort(table, dataset)
    }
    header.addEventListener('click', activate)
    header.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        activate()
      }
    })
  }

  // Re-apply the current sort when the user switches back to the Main tab.
  document.addEventListener('click', event => {
    const target = event.target as HTMLElement
    if (target?.closest?.('.govuk-tabs__list-item a[href="#main-list"]')) {
      applySort(table, dataset)
    }
  })
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMdtSort)
  } else {
    initMdtSort()
  }
}
