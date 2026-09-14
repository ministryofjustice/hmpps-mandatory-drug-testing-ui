import { expect, test } from '@playwright/test'
// eslint-disable-next-line import/no-named-as-default
import AxeBuilder from '@axe-core/playwright'
import mandatoryDrugTestingApi from '../mockApis/mandatoryDrugTestingApi'
import { login, resetStubs } from '../testUtils'
import type { MonthlyTestingList } from '../../server/interfaces/monthlyTestingList'

const NOW = new Date()
const CURRENT_MONTH = `${NOW.getUTCFullYear()}-${String(NOW.getUTCMonth() + 1).padStart(2, '0')}`

const populated: MonthlyTestingList = {
  id: 'L1',
  month: CURRENT_MONTH,
  prisonLocation: 'MDI',
  mainList: [
    {
      id: 'm1',
      listId: 'L1',
      listType: 'M',
      testedStatus: null,
      reasonNotTested: null,
      listSelectionNumber: 1,
      sampleTakenDate: null,
      lastTestedDate: null,
      prisoner: {
        prisonerNumber: 'A0001AA',
        firstName: 'DAN',
        lastName: 'WEHNER',
        cellLocation: 'A-01-001',
        releaseDate: null,
      },
      promoted: null,
    },
  ],
  reserveList: [
    {
      id: 'r1',
      listId: 'L1',
      listType: 'R',
      testedStatus: null,
      reasonNotTested: null,
      listSelectionNumber: 1,
      sampleTakenDate: null,
      lastTestedDate: null,
      prisoner: {
        prisonerNumber: 'A0002AA',
        firstName: 'JOHN',
        lastName: 'SMITH',
        cellLocation: 'A-01-002',
        releaseDate: null,
      },
      promoted: false,
    },
  ],
}

async function assertNoSeriousAxeViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, JSON.stringify(serious, null, 2)).toHaveLength(0)
}

test.describe('mdt-list accessibility', () => {
  test.beforeEach(async () => {
    await mandatoryDrugTestingApi.stubPing()
    await mandatoryDrugTestingApi.stubTestedReasons()
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  test('populated Main tab has zero critical/serious axe violations', async ({ page }) => {
    await login(page, { roles: ['ROLE_MANDATORY_DRUG_TESTING_RW'] })
    await mandatoryDrugTestingApi.stubMonthlyList({ prisonCode: 'MDI', listDate: CURRENT_MONTH, body: populated })

    await page.goto('/mdt-list')
    await assertNoSeriousAxeViolations(page)
  })

  test('empty state has zero critical/serious axe violations', async ({ page }) => {
    await login(page, { roles: ['ROLE_MANDATORY_DRUG_TESTING_RW'] })
    await mandatoryDrugTestingApi.stubMonthlyList({ prisonCode: 'MDI', listDate: CURRENT_MONTH, status: 404 })
    const prev = (() => {
      const d = new Date(NOW)
      d.setUTCMonth(d.getUTCMonth() - 1)
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    })()
    await mandatoryDrugTestingApi.stubMonthlyList({ prisonCode: 'MDI', listDate: prev, status: 404 })

    await page.goto('/mdt-list')
    await assertNoSeriousAxeViolations(page)
  })
})
