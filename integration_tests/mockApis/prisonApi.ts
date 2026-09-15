import type { SuperAgentRequest } from 'superagent'
import { stubFor, stubPing } from './wiremock'

export interface CaseLoad {
  caseLoadId: string
  description: string
  type: string
  caseloadFunction: string
  currentlyActive: boolean
}

export const DEFAULT_CASE_LOADS: CaseLoad[] = [
  {
    caseLoadId: 'MDI',
    description: 'HMP Moorland',
    type: 'INST',
    caseloadFunction: 'GENERAL',
    currentlyActive: true,
  },
]

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest => stubPing('/prison-api', httpStatus),

  stubUserCaseLoads: (caseLoads: CaseLoad[] = DEFAULT_CASE_LOADS): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPath: '/prison-api/api/users/me/caseLoads',
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: caseLoads,
      },
    }),
}
