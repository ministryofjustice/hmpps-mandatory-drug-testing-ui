import { expect, test } from '@playwright/test'
import hmppsAuth from '../mockApis/hmppsAuth'
import mandatoryDrugTestingApi from '../mockApis/mandatoryDrugTestingApi'

import { login, resetStubs } from '../testUtils'
import MdtListPage from '../pages/mdtListPage'

test.describe('SignIn', () => {
  test.beforeEach(async () => {
    await mandatoryDrugTestingApi.stubPing()
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  test('Unauthenticated user directed to auth', async ({ page }) => {
    await hmppsAuth.stubSignInPage()
    await page.goto('/')

    await expect(page.getByRole('heading')).toHaveText('Sign in')
  })

  test('Unauthenticated user navigating to sign in page directed to auth', async ({ page }) => {
    await hmppsAuth.stubSignInPage()
    await page.goto('/sign-in')

    await expect(page.getByRole('heading')).toHaveText('Sign in')
  })

  test('User name visible in header', async ({ page }) => {
    await login(page, { name: 'A TestUser' })
    await page.goto('/')

    const homePage = await MdtListPage.verifyOnPage(page)

    await expect(homePage.usersName).toHaveText('A. Testuser')
  })

  test('Phase banner visible in header', async ({ page }) => {
    await login(page)
    await page.goto('/')

    const homePage = await MdtListPage.verifyOnPage(page)

    await expect(homePage.phaseBanner).toHaveText('dev')
  })

  test('User can sign out', async ({ page }) => {
    await login(page)
    await page.goto('/')

    const homePage = await MdtListPage.verifyOnPage(page)
    await homePage.signOut()

    await expect(page.getByRole('heading')).toHaveText('Sign in')
  })

  test('User can manage their details', async ({ page }) => {
    await login(page, { name: 'A TestUser' })
    await page.goto('/')

    await hmppsAuth.stubManageDetailsPage()

    const homePage = await MdtListPage.verifyOnPage(page)
    await homePage.clickManageUserDetails()

    await expect(page.getByRole('heading')).toHaveText('Your account details')
  })

  test('Token verification failure takes user to sign in page', async ({ page }) => {
    await login(page, { active: false })

    await expect(page.getByRole('heading')).toHaveText('Sign in')
  })

  test('Token verification failure clears user session', async ({ page }) => {
    await login(page, { name: 'A TestUser', active: false })

    await expect(page.getByRole('heading')).toHaveText('Sign in')

    await login(page, { name: 'Some OtherTestUser', active: true })
    await page.goto('/')

    const homePage = await MdtListPage.verifyOnPage(page)
    await expect(homePage.usersName).toHaveText('S. Othertestuser')
  })
})
