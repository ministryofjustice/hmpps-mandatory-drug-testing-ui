import nock from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import MandatoryDrugTestingApiClient from './mandatoryDrugTestingApiClient'
import config from '../config'
import type { MonthlyTestingList } from '../interfaces/monthlyTestingList'
import type { TestedReason } from '../interfaces/testedReason'

describe('MandatoryDrugTestingApiClient', () => {
  let client: MandatoryDrugTestingApiClient
  let mockAuthenticationClient: jest.Mocked<AuthenticationClient>

  beforeEach(() => {
    mockAuthenticationClient = {
      getToken: jest.fn().mockResolvedValue('test-system-token'),
    } as unknown as jest.Mocked<AuthenticationClient>

    client = new MandatoryDrugTestingApiClient(mockAuthenticationClient)
  })

  afterEach(() => {
    nock.cleanAll()
    jest.resetAllMocks()
  })

  const stubList: MonthlyTestingList = {
    id: 'list-1',
    month: '2026-09',
    prisonLocation: 'MDI',
    mainList: [],
    reserveList: [],
  }

  describe('getMonthlyList', () => {
    it('returns the list on 200 with bearer token', async () => {
      nock(config.apis.mandatoryDrugTestingApi.url)
        .get('/prisons/MDI/mandatory-drug-testing-lists/2026-09')
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, stubList)

      const result = await client.getMonthlyList('MDI', '2026-09')

      expect(result).toEqual(stubList)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledTimes(1)
    })

    it('URL-encodes path params', async () => {
      nock(config.apis.mandatoryDrugTestingApi.url)
        .get('/prisons/M%2FDI/mandatory-drug-testing-lists/2026-09')
        .reply(200, stubList)

      const result = await client.getMonthlyList('M/DI', '2026-09')

      expect(result).toEqual(stubList)
    })

    it('returns null on 404', async () => {
      nock(config.apis.mandatoryDrugTestingApi.url).get('/prisons/MDI/mandatory-drug-testing-lists/2026-09').reply(404)

      const result = await client.getMonthlyList('MDI', '2026-09')

      expect(result).toBeNull()
    })

    it('rejects on 500', async () => {
      nock(config.apis.mandatoryDrugTestingApi.url)
        .get('/prisons/MDI/mandatory-drug-testing-lists/2026-09')
        .times(5)
        .reply(500, { error: 'boom' })

      await expect(client.getMonthlyList('MDI', '2026-09')).rejects.toBeDefined()
    }, 15000)
  })

  describe('getTestedReasons', () => {
    it('returns reasons on 200', async () => {
      const reasons: TestedReason[] = [{ code: 'REFUSE', description: 'Refused a test' }]
      nock(config.apis.mandatoryDrugTestingApi.url)
        .get('/reference-data/tested-reasons')
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, reasons)

      const result = await client.getTestedReasons()

      expect(result).toEqual(reasons)
    })

    it('returns empty array on 404', async () => {
      nock(config.apis.mandatoryDrugTestingApi.url).get('/reference-data/tested-reasons').reply(404)

      const result = await client.getTestedReasons()

      expect(result).toEqual([])
    })

    it('rejects on 500', async () => {
      nock(config.apis.mandatoryDrugTestingApi.url).get('/reference-data/tested-reasons').times(5).reply(500)

      await expect(client.getTestedReasons()).rejects.toBeDefined()
    }, 15000)
  })
})
