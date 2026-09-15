import { stubFor, stubPing as stubPingFor } from './wiremock'
import type { MonthlyTestingList } from '../../server/interfaces/monthlyTestingList'
import type { TestedReason } from '../../server/interfaces/testedReason'

const stubPing = (status = 200) => stubPingFor('/mdt-api', status)

const stubMonthlyList = ({
  prisonCode,
  listDate,
  body,
  status = 200,
}: {
  prisonCode: string
  listDate: string
  body?: MonthlyTestingList
  status?: number
}) =>
  stubFor({
    request: {
      method: 'GET',
      urlPattern: `/mdt-api/prisons/${prisonCode}/mandatory-drug-testing-lists/${listDate}`,
    },
    response: {
      status,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      jsonBody: body,
    },
  })

const stubTestedReasons = (reasons: TestedReason[] = [{ code: 'REFUSE', description: 'Refused a test' }]) =>
  stubFor({
    request: { method: 'GET', urlPattern: '/mdt-api/reference-data/tested-reasons' },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      jsonBody: reasons,
    },
  })

export default { stubPing, stubMonthlyList, stubTestedReasons }
