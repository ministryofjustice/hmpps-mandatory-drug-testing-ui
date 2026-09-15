import type { SuperAgentRequest } from 'superagent'
import { stubFor } from './wiremock'
import { convertToTitleCase, initialiseName } from '../../server/utils/utils'
import { DEFAULT_CASE_LOADS, type CaseLoad } from './prisonApi'

const headerHtml = (displayName: string | null, environmentName: string) => `
<header class="hmpps-header" role="banner">
  <div class="hmpps-header__container">
    <a class="hmpps-header__link" href="/">Digital Prison Services</a>
    ${environmentName ? `<strong class="govuk-tag" data-testid="header-phase-banner" data-qa="header-phase-banner">${environmentName}</strong>` : ''}
    <nav aria-label="Account navigation">
      <ul class="hmpps-header__navigation">
        <li class="hmpps-header__navigation__item">
          <a class="hmpps-header__link" href="/account-details" data-testid="manageDetails" data-qa="manageDetails">
            <span data-testid="header-user-name" data-qa="header-user-name">${displayName ?? ''}</span>
            <span class="govuk-visually-hidden"> - manage your details</span>
          </a>
        </li>
        <li class="hmpps-header__navigation__item">
          <a class="hmpps-header__link" href="/sign-out" data-testid="signOut" data-qa="signOut">Sign out</a>
        </li>
      </ul>
    </nav>
  </div>
</header>`

const footerHtml = `
<footer class="govuk-footer" role="contentinfo">
  <div class="govuk-footer__meta">
    <a class="govuk-footer__link" href="https://www.gov.uk/help">Help</a>
  </div>
</footer>`

export default {
  /**
   * Stubs the DPS frontend components API, which supplies the shared header and footer.
   * Without this the components library silently falls back to its own header, which does
   * not expose the test ids the page objects rely on.
   */
  stubComponents: ({
    name = 'john smith',
    environmentName = 'dev',
    caseLoads = DEFAULT_CASE_LOADS,
  }: { name?: string; environmentName?: string; caseLoads?: CaseLoad[] } = {}): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPath: '/component-api/components',
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: {
          header: {
            html: headerHtml(initialiseName(convertToTitleCase(name)), environmentName),
            css: [],
            javascript: [],
          },
          footer: { html: footerHtml, css: [], javascript: [] },
          meta: {
            activeCaseLoad: caseLoads.find(caseLoad => caseLoad.currentlyActive) ?? null,
            caseLoads,
            services: [],
          },
        },
      },
    }),
}
