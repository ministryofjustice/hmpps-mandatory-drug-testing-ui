// Client-side sort for the MDT prisoner list.
// Reads the row dataset embedded as JSON, sorts the tbody rows in place,
// updates aria-sort on the active header, and persists sort state across tab switches
// via module scope (state resets on page reload).

interface SortKeyRow {
  entryId: string
  prisonerName: string
  originalList: 'Main' | 'Reserve'
  locationSortKey: Array<string | number>
  releaseSortKey: number
  lastSelectedSortKey: { group: number; recencyMonths: number }
  statusSortKey: number
}

type SortField = 'prisoner' | 'originalList' | 'location' | 'release' | 'lastSelected' | 'status'
type SortDirection = 'ascending' | 'descending'

interface CurrentSortState {
  field: SortField | null
  direction: SortDirection
}

const COLUMN_INDEX_TO_SORT_FIELD: Record<number, SortField> = {
  0: 'prisoner',
  1: 'originalList',
  2: 'location',
  3: 'release',
  4: 'lastSelected',
  5: 'status',
}

const MDT_LIST_DATA_ELEMENT_ID = 'mdt-list-data'
const MDT_MAIN_TABLE_SELECTOR = '[data-testid="mdt-main-table"]'
const MAIN_LIST_TAB_SELECTOR = '.govuk-tabs__list-item a[href="#main-list"]'

function loadSortDataFromPage(): SortKeyRow[] {
  const dataElement = document.getElementById(MDT_LIST_DATA_ELEMENT_ID)
  if (!dataElement) return []

  try {
    return JSON.parse(dataElement.textContent || '[]') as SortKeyRow[]
  } catch {
    return []
  }
}

function compareMultiPartKey(keyA: Array<string | number>, keyB: Array<string | number>): number {
  const minLength = Math.min(keyA.length, keyB.length)

  for (let index = 0; index < minLength; index += 1) {
    const valueA = keyA[index]
    const valueB = keyB[index]

    if (typeof valueA === 'number' && typeof valueB === 'number') {
      if (valueA !== valueB) return valueA - valueB
    } else if (typeof valueA === 'string' && typeof valueB === 'string') {
      const comparisonResult = valueA.localeCompare(valueB, 'en-GB', { sensitivity: 'base' })
      if (comparisonResult !== 0) return comparisonResult
    } else {
      // Numbers sort before strings
      return typeof valueA === 'number' ? -1 : 1
    }
  }

  // If all compared elements are equal, shorter array comes first
  return keyA.length - keyB.length
}

function compareRowsByField(fieldToSort: SortField, rowA: SortKeyRow, rowB: SortKeyRow): number {
  switch (fieldToSort) {
    case 'prisoner':
      return rowA.prisonerName.localeCompare(rowB.prisonerName, undefined, {
        sensitivity: 'base',
      })

    case 'originalList':
      return rowA.originalList.localeCompare(rowB.originalList)

    case 'location':
      return compareMultiPartKey(rowA.locationSortKey, rowB.locationSortKey)

    case 'release':
      return rowA.releaseSortKey - rowB.releaseSortKey

    case 'lastSelected': {
      const groupDifference = rowA.lastSelectedSortKey.group - rowB.lastSelectedSortKey.group
      if (groupDifference !== 0) return groupDifference
      return rowA.lastSelectedSortKey.recencyMonths - rowB.lastSelectedSortKey.recencyMonths
    }

    case 'status':
      return rowA.statusSortKey - rowB.statusSortKey

    default:
      return 0
  }
}

const currentSort: CurrentSortState = { field: null, direction: 'ascending' }

function applyCurrentSortToTable(table: HTMLTableElement, dataset: SortKeyRow[]): void {
  if (!currentSort.field) return

  // Sort a copy of the dataset
  const sortedRows = dataset.slice().sort((rowA, rowB) => compareRowsByField(currentSort.field!, rowA, rowB))

  if (currentSort.direction === 'descending') {
    sortedRows.reverse()
  }

  // Reorder DOM elements in tbody by moving them to the end
  const tableBody = table.tBodies[0]
  if (!tableBody) return

  const rowElementsById = new Map<string, HTMLTableRowElement>()
  Array.from(tableBody.rows).forEach(rowElement => {
    const rowId = rowElement.getAttribute('data-entry-id')
    if (rowId) rowElementsById.set(rowId, rowElement)
  })

  for (const dataRow of sortedRows) {
    const rowElement = rowElementsById.get(dataRow.entryId)
    if (rowElement) tableBody.appendChild(rowElement)
  }

  // Update aria-sort attribute on all headers
  const headerCells = table.tHead?.rows[0]?.cells
  if (!headerCells) return

  for (let columnIndex = 0; columnIndex < headerCells.length; columnIndex += 1) {
    const headerCell = headerCells[columnIndex]
    const columnSortField = COLUMN_INDEX_TO_SORT_FIELD[columnIndex]

    if (columnSortField) {
      const isCurrentlySortedColumn = columnSortField === currentSort.field
      const ariaSortValue = isCurrentlySortedColumn ? currentSort.direction : 'none'
      headerCell.setAttribute('aria-sort', ariaSortValue)
    }
  }
}

export default function initMdtSort(): void {
  const table = document.querySelector<HTMLTableElement>(MDT_MAIN_TABLE_SELECTOR)
  if (!table) return

  const dataset = loadSortDataFromPage()
  const headerCells = table.tHead?.rows[0]?.cells
  if (!headerCells) return

  // Attach sort handlers to sortable column headers
  for (let columnIndex = 0; columnIndex < headerCells.length; columnIndex += 1) {
    const headerCell = headerCells[columnIndex]
    const fieldForThisColumn = COLUMN_INDEX_TO_SORT_FIELD[columnIndex]

    if (fieldForThisColumn) {
      // Make header keyboard accessible
      headerCell.setAttribute('role', 'button')
      headerCell.setAttribute('tabindex', '0')

      const handleHeaderClick = (): void => {
        if (currentSort.field === fieldForThisColumn) {
          // Same column clicked: toggle sort direction
          currentSort.direction = currentSort.direction === 'ascending' ? 'descending' : 'ascending'
        } else {
          // Different column clicked: switch to that column and reset to ascending
          currentSort.field = fieldForThisColumn
          currentSort.direction = 'ascending'
        }

        applyCurrentSortToTable(table, dataset)
      }

      headerCell.addEventListener('click', handleHeaderClick)

      // Handle keyboard activation (Enter and Space keys)
      headerCell.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleHeaderClick()
        }
      })
    }
  }

  // Re-apply sort when user switches back to the Main list tab
  document.addEventListener('click', event => {
    const clickTarget = event.target as HTMLElement
    if (clickTarget?.closest?.(MAIN_LIST_TAB_SELECTOR)) {
      applyCurrentSortToTable(table, dataset)
    }
  })
}

// Initialize on page load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMdtSort)
  } else {
    initMdtSort()
  }
}
