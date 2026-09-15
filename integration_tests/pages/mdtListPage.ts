import { expect, Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class MdtListPage extends AbstractPage {
  static async verifyOnPage(page: Page): Promise<MdtListPage> {
    await expect(page.getByTestId('mdt-heading')).toBeVisible()
    return new MdtListPage(page)
  }

  get caption() {
    return this.page.getByTestId('mdt-caption')
  }

  get heading() {
    return this.page.getByTestId('mdt-heading')
  }

  get mainTable() {
    return this.page.getByTestId('mdt-main-table')
  }

  get reserveTable() {
    return this.page.getByTestId('mdt-reserve-table')
  }
}
