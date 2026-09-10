# Contract — `/mdt-list` UI route

**Producer**: `hmpps-mandatory-drug-testing-ui` (this repo).
**Consumers**: browsers (officers and prison admins in DPS); Playwright end-to-end tests; axe-core accessibility scans.

## Route

- **Method**: `GET`
- **Path**: `/mdt-list`
- **Full URL** (per FR-022): `mdt-ui[-dev].hmpps.service.justice.gov.uk/mdt-list` depending on environment.
- **Query params**: none in this feature. (Sort/pagination are client-side per `research.md` R-1.)
- **Auth**: DPS SSO session (existing `setUpAuthentication`). Then role-gated by `requirePermissions` middleware.

## Access control (FR-029)

The route is protected by `requirePermissions` factory (`server/middleware/permissions/requirePermissions.ts`):

| Role                              | `UserPermissionLevel` | Result                                            |
|-----------------------------------|-----------------------|---------------------------------------------------|
| `MANDATORY_DRUG_TESTING_RO`       | `VIEW_ONLY`           | 200 render; "Record test" swapped for "No action needed"; no other write path present. |
| `MANDATORY_DRUG_TESTING_RW`       | `MANAGE`              | 200 render; "Record test" link enabled.           |
| `MANDATORY_DRUG_TESTING_RWU`      | `MANAGE`              | 200 render; "Record test" link enabled.           |
| Any of the above absent           | `FORBIDDEN`           | 403 render with the standard DPS "not authorised" page. |

## Prerequisites populated on `res.locals`

Populated by middleware **before** the controller runs:

- `res.locals.user` — populated by `setUpCurrentUser` (existing).
- `res.locals.user.activeCaseLoadId` — populated by `retrieveCaseLoadData({ logger, prisonApiConfig: config.apis.prisonApi })` from `@ministryofjustice/hmpps-connect-dps-components` (NEW wiring). See `research/technical-brief.md` §3.
- `res.locals.permissions` — populated by `populateUserPermissions` (NEW).
- `res.locals.frontendComponents` — populated by the DPS components middleware (existing).

If `activeCaseLoadId` is missing at controller time, respond with 500 and log ERROR — this is a config/middleware bug, not a user error.

## Response (200)

**Content-Type**: `text/html; charset=utf-8`

**Title tag**: `MDT list - Mandatory drug testing - DPS` (per FR-022).

### Landmarks and structure (accessibility + Playwright selectors)

The page uses the DPS Header/Footer chrome (via `hmpps-connect-dps-components`) and the following semantic structure:

```
<header>  DPS Header (from connect-dps-components)
<nav aria-label="Breadcrumb">  GOV.UK Breadcrumbs
<main id="main-content">
  <p class="govuk-caption-xl">  {caption}     ← FR-023  "HMP Moorland"
  <h1 class="govuk-heading-xl"> {heading}     ← FR-023  "September 2026"

  <details class="govuk-details">              ← FR-024 "How are the testing lists ordered?"
    <summary>…</summary>
    <table>… metadata rows …</table>
    <p>… body text …</p>
  </details>

  <div class="govuk-button-group">              ← FR-025 secondary buttons
    <a class="govuk-button govuk-button--secondary" href="#">View previous months</a>
    <a class="govuk-button govuk-button--secondary" href="#">Print testing list</a>
  </div>

  <div class="govuk-tabs" data-module="govuk-tabs">    ← AC #3 tabs
    <h2 class="govuk-tabs__title">Contents</h2>
    <ul class="govuk-tabs__list">
      <li><a href="#main-list">Main list</a></li>
      <li><a href="#reserve-list">Reserve list</a></li>
    </ul>

    <section id="main-list" class="govuk-tabs__panel">
      <h2 class="govuk-heading-l">Main list</h2>
      <div class="mdt-summary-blocks">           ← FR-024  three summary blocks
        …
      </div>
      <table class="govuk-table" data-module="moj-sortable-table" data-testid="mdt-main-table">
        …  ← Sortable table
      </table>
      <nav class="moj-pagination" data-testid="mdt-main-pagination">…</nav>
    </section>

    <section id="reserve-list" class="govuk-tabs__panel govuk-tabs__panel--hidden">
      <h2 class="govuk-heading-l">Reserve list</h2>
      <p>Reserves are used when a main-list prisoner cannot be tested. They need to be tested in list order if used.</p>
      <table class="govuk-table" data-testid="mdt-reserve-table">
        …  ← Plain table, no sort behaviour
      </table>
    </section>
  </div>
</main>
<footer>  DPS Footer
```

### `data-` attributes stable for tests

| Selector                          | Purpose                                               |
|-----------------------------------|-------------------------------------------------------|
| `[data-testid="mdt-caption"]`     | Prison caption span                                   |
| `[data-testid="mdt-heading"]`     | Month/year `<h1>`                                     |
| `[data-testid="mdt-main-table"]`  | Main list table                                       |
| `[data-testid="mdt-reserve-table"]` | Reserve list table                                  |
| `[data-testid="mdt-details"]`     | Details component                                     |
| `[data-testid="mdt-summary-completed"]` | Completed summary block                        |
| `[data-testid="mdt-summary-releasing"]` | Releasing this month summary block             |
| `[data-testid="mdt-summary-weekend"]`   | Tested on weekend summary block                |
| `[data-entry-id="{uuid}"]`        | On every `<tr>` — for targeting specific rows         |
| `[data-testid="mdt-action-record-test"]`  | Record test link cells (RW/RWU only)          |
| `[data-testid="mdt-action-no-action"]`    | "No action needed" cells                       |
| `[data-testid="mdt-action-replaced"]`     | "Replaced by reserve due to…" cells            |
| `[data-testid="mdt-action-wait-previous"]` | "Test previous reserve first" cells           |

### Client-side JS data

The full row dataset is embedded once as a `<script type="application/json" id="mdt-list-data">…</script>` block for the client sort/pagination module to consume. This avoids re-serialising on every user interaction and keeps the no-JS baseline usable.

## Response (403)

Rendered by `requirePermissions` when neither RO nor RW/RWU role is present. Standard DPS "not authorised" page, `<title>Not authorised - DPS</title>`, HTTP 403.

## Response (empty-state and previous-month fallback, HTTP 200)

Per `contracts/mdt-list-endpoint.md` and `research.md` R-7, the FE handles a 404 on the current month by retrying ONCE for the previous month:

- **Previous-month 200 (fallback)**: renders normally with the previous month's data. A GOV.UK notification banner appears above the tabs stating that the current month's list has not been generated yet and the previous month is being shown. `<h1>` reflects the fallback month, not the requested month. HTTP status is 200.
- **Previous-month 404 (empty state)**: renders with chrome, caption, heading, breadcrumbs unchanged; no tabs, no tables. In their place: a `govuk-panel` element with the exact message **"No lists currently exist for this prison, please contact your MDT Coordinator to generate a new list"**. HTTP status is 200.

## Action rendering — `REFUSE` link (FR-009, FR-018)

When a Main-list row has `reasonNotTested === "REFUSE"`, the Action cell renders `Replaced by reserve due to {description}` as an `<a>` element whose `href` is derived FE-side from `config.manageAdjudications.urlTemplate` (env `MANAGE_ADJUDICATIONS_URL`; dev default `https://manage-adjudications-dev.hmpps.service.justice.gov.uk/incident-details/{prisonerNumber}`), with `{prisonerNumber}` substituted by the row's `prisonerNumber`. `target="_blank" rel="noopener noreferrer"`. All other reason codes render as plain text.

## Accessibility contract

- Zero critical or serious `axe-core` violations on the rendered page (both populated and empty-state variants).
- Keyboard: Tab order = caption → h1 → Details summary → View previous months → Print testing list → Main list tab → Reserve list tab → column headers of the active panel → first row → row 2 → … → pagination controls.
- Every sortable column header MUST expose `aria-sort` and update it on activation.
- Every Tag component MUST have accessible text equal to its visible text.
- The Details component MUST be reachable and toggleable with Enter and Space.
- Focus MUST be preserved on the active tab across in-page tab switches.

## Verification

- **Unit**: `mdtListController.test.ts` covers rendering with populated data, empty state, and 403 branch.
- **Integration / e2e** (`integration_tests/mdt-list.spec.ts`): one Playwright test per user story US1–US7 (see `plan.md` Phase 1 test-list expansion).
- **Accessibility** (`integration_tests/mdt-list.a11y.spec.ts`): axe-core on populated and empty variants.
