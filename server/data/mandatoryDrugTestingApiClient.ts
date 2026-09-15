import { RestClient, asSystem } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'
import type { MonthlyTestingList } from '../interfaces/monthlyTestingList'
import type { TestedReason } from '../interfaces/testedReason'

export default class MandatoryDrugTestingApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('Mandatory Drug Testing API', config.apis.mandatoryDrugTestingApi, logger, authenticationClient)
  }

  async getMonthlyList(prisonCode: string, listDate: string): Promise<MonthlyTestingList | null> {
    const path = `/prisons/${encodeURIComponent(prisonCode)}/mandatory-drug-testing-lists/${encodeURIComponent(listDate)}`
    try {
      return await this.get<MonthlyTestingList>({ path }, asSystem())
    } catch (error) {
      if (error?.responseStatus === 404 || error?.status === 404) {
        return null
      }
      throw error
    }
  }

  async getTestedReasons(): Promise<TestedReason[]> {
    try {
      return await this.get<TestedReason[]>({ path: '/reference-data/tested-reasons' }, asSystem())
    } catch (error) {
      if (error?.responseStatus === 404 || error?.status === 404) {
        return []
      }
      throw error
    }
  }
}
