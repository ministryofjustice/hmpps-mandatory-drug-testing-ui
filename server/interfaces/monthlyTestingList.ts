export interface Prisoner {
  firstName: string
  lastName: string
  location: string
  releaseDate: string | null
}

export interface TestingListEntry {
  id: string
  listId: string
  prisonerNumber: string
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
