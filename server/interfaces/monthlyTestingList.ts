export interface Prisoner {
  prisonerNumber: string
  firstName: string
  lastName: string
  cellLocation: string
  releaseDate: string | null
}

export interface TestingListEntry {
  id: string
  listId: string
  listType: 'M' | 'R'
  testedStatus: boolean | null
  reasonNotTested: string | null
  listSelectionNumber: number
  sampleTakenDate: string | null
  lastTestedDate: string | null
  prisoner: Prisoner
  promoted: boolean | null
  notes?: string | null
}

export interface MonthlyTestingList {
  id: string
  month: string
  prisonLocation: string
  mainList: TestingListEntry[]
  reserveList: TestingListEntry[]
}
