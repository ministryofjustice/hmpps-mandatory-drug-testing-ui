# Technical Brief — Mandatory Drug Testing Main & Reserve Lists

**Feature**: [001-prisoner-testing-lists](../spec.md)
**Purpose**: Capture the technical context needed to plan and implement the feature. Feeds into `/speckit.plan`. Behaviour lives in `spec.md`; this file records dependencies, contracts, patterns and file-level intent only.

---

## 1. Backend API dependency

### Base URLs

| Environment | Base URL |
|---|---|
| Dev | `https://mandatory-drug-testing-api-dev.hmpps.service.justice.gov.uk` |
| Pre-prod | TBC |
| Prod | TBC |

To be added to `server/config.ts` under `apis.mandatoryDrugTestingApi`, replacing the existing `apis.exampleApi` block (see §9). Required env vars (with sensible dev defaults):

- `MANDATORY_DRUG_TESTING_API_URL` (dev default: `https://mandatory-drug-testing-api-dev.hmpps.service.justice.gov.uk`)
- `MANDATORY_DRUG_TESTING_API_TIMEOUT_RESPONSE` (default 5000)
- `MANDATORY_DRUG_TESTING_API_TIMEOUT_DEADLINE` (default 5000)
- `MANDATORY_DRUG_TESTING_API_HEALTH_PATH` = `/health/ping`

The existing `CLIENT_CREDS_CLIENT_ID` / `CLIENT_CREDS_CLIENT_SECRET` env vars (already declared in `apis.hmppsAuth.systemClientId` / `.systemClientSecret`) are reused for building the system token used against this endpoint — see §3.

### Endpoint used by this feature

```
GET /prisons/{prisonCode}/mandatory-drug-testing-lists/{listDate}
GET /reference-data/tested-reasons
```

**Path parameters**

| Param | Source | Format |
|---|---|---|
| `prisonCode` | `res.locals.user.activeCaseLoadId` | e.g. `MDI` |
| `listDate` | Current month at page load | `YYYY-MM` (UTC) |

**Auth**: system token via `hmpps-rest-client`'s `asSystem()` helper. Under the hood this uses `hmpps-auth-clients`'s `AuthenticationClient` to request a token from HMPPS Auth via the OAuth 2.0 client-credentials grant, using `CLIENT_CREDS_CLIENT_ID` and `CLIENT_CREDS_CLIENT_SECRET` (already declared as `apis.hmppsAuth.systemClientId` / `.systemClientSecret` in `server/config.ts`), and attaches the resulting token as `Authorization: Bearer <token>`. See §3 for the client pattern.

**Response shape** (updated 2026-09-10):

```jsonc
{
  "id": "ed3af076-2e01-427d-a24c-ed48ad640ea7",
  "month": "2026-09",
  "prisonLocation": "MDI",           // was prisonCode — establishment code
  "mainList": [
    {
      "id": "53225683-0998-4c3d-80b3-babf63324ee3",
      "listId": "ed3af076-2e01-427d-a24c-ed48ad640ea7", // parent list id (== envelope id)
      "prisonerNumber": "A0036EC",   // hoisted to entry level
      "listType": "M",               // always "M" on mainList entries; always "R" on reserveList entries
      "testedStatus": null,          // nullable boolean:
                                     //   true  = Sample taken
                                     //   false = Unable to test
                                     //   null  = Not started
      "reasonNotTested": null,       // reason code (string) when testedStatus === false;
                                     //   resolved via /reference-data/tested-reasons
      "listSelectionNumber": 1,      // generation order within the list
      "sampleTakenDate": null,       // full date (YYYY-MM-DD) the sample was taken;
                                     //   drives the "Tested on weekend" count (see R-5)
      "lastTestedDate": null,        // most recent recorded test date at any establishment;
                                     //   drives the Last selected month column
      "prisoner": {
        "firstName": "DAN",
        "lastName": "WEHNER",
        "location": "RECP",          // was cellLocation — displayed verbatim (see §2)
        "releaseDate": null          // ISO date (YYYY-MM-DD) or null
      },
      "promoted": null,              // ALWAYS null on main-list entries
      "notes": null
    }
  ],
  "reserveList": [
    {
      "id": "09d5e146-64a6-42bf-8d0d-8039cdba54f8",
      "listId": "ed3af076-2e01-427d-a24c-ed48ad640ea7",
      "prisonerNumber": "A0048DZ",
      "listType": "R",
      "testedStatus": null,
      "reasonNotTested": null,
      "listSelectionNumber": 1,      // drives the reserve tab Order column
      "sampleTakenDate": null,
      "lastTestedDate": null,
      "prisoner": {
        "firstName": "JOHN",
        "lastName": "SMITH",
        "location": "1-3-037",
        "releaseDate": null
      },
      "promoted": false,             // false = "Available as reserve";
                                     // true  = "Moved to main list" — the FE surfaces this
                                     //         entry as an extra row on the Main list VIEW.
                                     //         The API response never duplicates it into mainList.
      "notes": null
    }
  ]
}
```

**Guarantees & non-guarantees**:
- When the endpoint returns 200, both `mainList` and `reserveList` are always populated (BE guarantee — a generated list always has both). No list ever exists with empty arrays: the BE returns 404 instead.
- A 404 means no list exists for that prison + month. The FE MUST re-issue the call with the previous month; if that too returns 404, render the "no lists currently exist" static message (see R-7).

**BE items (recap of decisions)**

- **Reason lookup endpoint** — `reasonNotTested` is returned as a code; display text resolved by `GET /reference-data/tested-reasons` on the MDT API (shape `[{ code, description }]` — see §7 and `contracts/tested-reasons-endpoint.md`). No `url` field on the reference data — the "refusing the test" out-link (adjudication service) is FE-owned via the `MANAGE_ADJUDICATIONS_URL` env var (see §3). The code that triggers the out-link is `REFUSE`.
- **Promotion signalling** — clarified 2026-09-10: `listType` on an API entry is fully determined by which array it lives in. Every `mainList` entry has `listType === "M"`; every `reserveList` entry has `listType === "R"`. The BE NEVER duplicates a reserve into `mainList`. A reserve that has been called up is signalled by `promoted === true` on the reserve entry — the FE builds the Main-list VIEW by concatenating `mainList` with `reserveList.filter(r => r.promoted === true)`. `promoted` on `mainList` entries is always `null` and is ignored. `promoted` on `reserveList` entries: `false` = "Available as reserve"; `true` = "Moved to main list". No promotion count is inferred.

---

## 2. Domain → view mapping

| Spec column / value | Source field | Notes |
|---|---|---|
| Prisoner name | `prisoner.lastName`, `prisoner.firstName` | Render as `"{lastName}, {firstName}"` |
| Prisoner number (under name) | `prisonerNumber` (entry-level; hoisted since 2026-09-10) | |
| Original list (Main list only) | Which array the source entry came from | `mainList` entry → "Main"; `reserveList` entry with `promoted === true` (surfaced FE-side into the Main list VIEW) → "Reserve". Equivalent to `listType` (M/R) once the FE has classified the source. |
| Location | `prisoner.location` (was `cellLocation`) | Displayed verbatim from the API — any string is valid (`"A-03-091"`, `"RECP"`, etc.). Live per API (see FR-027). Sort per Location sort rule below. |
| Release date (CRD) | `prisoner.releaseDate` | Format `DD Mon YYYY`; `null` → **"No data available"**. |
| Last selected month | `lastTestedDate` | Format `Month YYYY`; `null` → "Not tested before" |
| Status (Main list Tag) | `testedStatus` (nullable boolean) | `null` → "Not started"; `true` → "Sample taken"; `false` → "Unable to test" |
| Status (Reserve tab Tag) | `promoted` (nullable boolean on reserve entries) | `false`/absent → "Available as reserve"; `true` → "Moved to main list". On main-list entries `promoted` is always `null` and is ignored for rendering. |
| Order (Reserve tab) | `listSelectionNumber` | Ascending |
| Action (Main list) | Derived from Status + `originalList` + reserve ordering + `reasonNotTested` (+ viewer role) | See FR-011 / FR-018. For promoted-reserve rows (source entry from `reserveList` with `promoted === true`, "Not started"), the row shows "Record test" only if it has the lowest `listSelectionNumber` among all still-untested promoted reserves on the Main-list view; every other promoted-and-untested reserve shows "Test previous reserve first". Reason display text resolved by calling `GET /reference-data/tested-reasons` on the MDT API and looking up the code; for the `REFUSE` code the action is rendered as a link to `MANAGE_ADJUDICATIONS_URL` (env var, `{prisonerNumber}` template variable substituted — see §3 / `contracts/tested-reasons-endpoint.md`). |
| "Tested on weekend" summary count (FR-024) | Derived from `sampleTakenDate` on `mainList` entries | Count of rows where `sampleTakenDate` falls on a Saturday or Sunday. Resolves R-5. |

**Location sort rule** — since `prisoner.location` is a free-form string that may be structured (`"A-03-091"`, `"1-3-037"`) or a plain token (`"RECP"`), the FE MUST use a natural alphanumeric comparator: split each string into runs of digits vs non-digits, compare non-digit runs lexicographically, and compare digit runs numerically. This ensures `"A-03-091"` sorts between `"A-03-090"` and `"A-03-092"` (not after `"A-03-9"`), and non-structured values like `"RECP"` sort predictably relative to structured wing codes.

### Sort behaviour (client-side)

The Main-list VIEW is built by concatenating `mainList[]` with `reserveList.filter(r => r.promoted === true)` — the API response NEVER duplicates a reserve into `mainList`. All rows in that view are treated as a single dataset for sorting purposes:

1. Both source groups — original main-list entries AND promoted reserves — participate in the same sort per FR-005 / US2 AC #3–8. There is no sticky positioning.
2. Default sort (no explicit user sort) matches the order returned by the API: original main-list entries first in their API order (preserving the randomly generated selection), followed by promoted reserves ordered by `listSelectionNumber` ascending.
3. The "Original list" sort (US2 AC #4) works on the derived `originalList` view field: ascending → `"Main"` before `"Reserve"`; descending → `"Reserve"` before `"Main"`.

Sort applies across the whole main-list dataset before pagination (FR-019); pagination is a view-only slice on top.

Reserve tab: no sort ever applied; render the ENTIRE `reserveList` as-returned, ordered by `listSelectionNumber` ascending (FR-006). A reserve with `promoted === true` remains in the Reserve tab (with the "Moved to main list" Tag) AND appears in the Main-list view — the same underlying entry rendered twice, once per tab.

### Promoted-reserve action rule (client-side)

When rendering each Main-list VIEW row's Action cell for `testedStatus === null` (Status "Not started"):

- If the row was sourced from `mainList[]` (i.e. `originalList === "Main"`) → "Record test" (subject to role gate).
- If the row was sourced from `reserveList[]` with `promoted === true` (i.e. `originalList === "Reserve"`) → look up all other Main-list VIEW rows with `originalList === "Reserve"` and `testedStatus === null`. If this row has the lowest `listSelectionNumber` among them → "Record test" (subject to role gate). Otherwise → the plain text "Test previous reserve first" (no link, no role gating — this text overrides the "Record test" link even for writer roles, because it enforces the ordering constraint).

---

## 3. Auth & roles

### Role definitions (canonical for this feature)

| Role (JWT authority name, unprefixed) | Access |
|---|---|
| `MANDATORY_DRUG_TESTING_RO` | Can view the page; **cannot** activate "Record test". Action cell for "Not started" rows renders "No action needed". |
| `MANDATORY_DRUG_TESTING_RW` | Full access, incl. "Record test" |
| `MANDATORY_DRUG_TESTING_RWU` | Full access, incl. "Record test" |
| Any other / none | Redirected to `/authError` (existing pattern) |

JWT authorities are prefixed `ROLE_` on the wire — the existing `authorisationMiddleware` normalises this.

### Middleware design (following `hmpps-transfer-scheduler-ui`)

Create a new `server/middleware/permissions/` folder:

- **`server/middleware/permissions/populateUserPermissions.ts`** — reads `res.locals.user.userRoles`, sets `res.locals.user.permission` to one of an enum (`FORBIDDEN | VIEW_ONLY | MANAGE`).
- **`server/middleware/permissions/requirePermissions.ts`** — factory `requirePermissions(level)` that guards a route; renders `pages/service-not-authorised` (new template) if level insufficient.
- Extend `server/interfaces/hmppsUser.ts` with a `UserPermissionLevel` enum and a `permission: UserPermissionLevel` field on `BaseUser`.
- Wire `populateUserPermissions` into `server/app.ts` after `setUpCurrentUser`.

**Route-level guarding**

- `/mdt-list` GET → `requirePermissions(UserPermissionLevel.VIEW_ONLY)` — RO, RW, RWU all pass.
- `/mdt-list/:id/record-test` (delivered in the follow-up test-recording feature) → `requirePermissions(UserPermissionLevel.MANAGE)` — RW / RWU only. This feature only guarantees the entry point's presence per role in the view.

**Template exposure**

Expose a Nunjucks filter or `res.locals` boolean (`canRecordTest`) so the template can render "Record test" as a link vs "No action needed" without duplicating role checks. Reference repo does this via `hasPermissionFilter`.

### MDT API client pattern

The MDT API client is a thin `RestClient` subclass. Requests use `asSystem()` from `hmpps-rest-client`, which triggers `AuthenticationClient` (already constructed in `server/data/index.ts` from `@ministryofjustice/hmpps-auth-clients`) to fetch a system token via client-credentials (`systemClientId` + `systemClientSecret`) and attach it as `Authorization: Bearer <token>`. Token caching is handled by `AuthenticationClient`'s `TokenStore` (in-memory in dev, Redis in prod).

**Pattern**:

```ts
// server/data/mandatoryDrugTestingApiClient.ts
import { RestClient, asSystem } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'
import type { MonthlyTestingList } from '../interfaces/monthlyTestingList'

export default class MandatoryDrugTestingApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('Mandatory Drug Testing API', config.apis.mandatoryDrugTestingApi, logger, authenticationClient)
  }

  getMonthlyList(prisonCode: string, listDate: string): Promise<MonthlyTestingList | null> {
    return this.get<MonthlyTestingList | null>(
      {
        path: `/prisons/${encodeURIComponent(prisonCode)}/mandatory-drug-testing-lists/${encodeURIComponent(listDate)}`,
      },
      asSystem(),
    ) // 404 → null (see contracts/mdt-list-endpoint.md / research.md R-7)
  }

  getTestedReasons(): Promise<TestedReason[]> {
    return this.get<TestedReason[]>(
      { path: '/reference-data/tested-reasons' },
      asSystem(),
    )
  }
}
```

Where `TestedReason` is `{ code: string; description: string }` (see `contracts/tested-reasons-endpoint.md`). No `url` field — the adjudication out-link for `REFUSE` is FE-owned via the `MANAGE_ADJUDICATIONS_URL` env var.

**Verification** — a `MandatoryDrugTestingApiClient.test.ts` MUST cover:
1. Successful `getMonthlyList` call: mocks the BE via `nock` with the expected path; asserts the client resolves with the shaped response.
2. Successful `getTestedReasons` call: mocks the reference-data endpoint; asserts the client resolves with the shaped array.
3. BE 5xx / timeout on either endpoint: surfaces upstream.
4. Auth failure: `AuthenticationClient` token fetch rejects → error propagates.

---

### `activeCaseLoadId` availability

`PrisonUser.activeCaseLoadId` is declared in `server/interfaces/hmppsUser.ts` but is **not** populated by the current `setUpCurrentUser` middleware. It MUST be populated before the MDT API can be called.

**Approach**: use the `retrieveCaseLoadData` middleware shipped by `@ministryofjustice/hmpps-connect-dps-components` (already a dependency at `6.3.3`). Wire it into `server/app.ts` after `setUpCurrentUser`:

```ts
// server/app.ts
import retrieveCaseLoadData from '@ministryofjustice/hmpps-connect-dps-components/dist/middleware/retrieveCaseLoadData'
// ...
app.use(setUpCurrentUser())
app.use(
  retrieveCaseLoadData({
    logger,
    prisonApiConfig: config.apis.prisonApi,
  }),
)
app.use(setUpCsrf())
```

The middleware calls the HMPPS Prison API (`GET /users/me`) using the user's own token, populates the caseload on `res.locals.user`, and caches per-session so it isn't fetched on every request.

**New Prison API config block** — add to `server/config.ts` under `apis`:

```ts
prisonApi: {
  healthPath: '/health/ping',
  url: get('PRISON_API_URL', 'http://127.0.0.1:8080', requiredInProduction),
  timeout: {
    response: Number(get('PRISON_API_TIMEOUT_RESPONSE', 10000)),
    deadline: Number(get('PRISON_API_TIMEOUT_DEADLINE', 10000)),
  },
  agent: new AgentConfig(Number(get('PRISON_API_TIMEOUT_RESPONSE', 10000))),
},
mandatoryDrugTestingApi: {
  healthPath: '/health/ping',
  url: get('MANDATORY_DRUG_TESTING_API_URL', 'http://127.0.0.1:8080', requiredInProduction),
  timeout: {
    response: Number(get('MANDATORY_DRUG_TESTING_API_TIMEOUT_RESPONSE', 10000)),
    deadline: Number(get('MANDATORY_DRUG_TESTING_API_TIMEOUT_DEADLINE', 10000)),
  },
  agent: new AgentConfig(Number(get('MANDATORY_DRUG_TESTING_API_TIMEOUT_RESPONSE', 10000))),
},
```

**New `manageAdjudications` config block** — the "refusing the test" out-link is FE-owned. Add to `server/config.ts`:

```ts
manageAdjudications: {
  // URL template; {prisonerNumber} is substituted at render time.
  urlTemplate: get(
    'MANAGE_ADJUDICATIONS_URL',
    'https://manage-adjudications-dev.hmpps.service.justice.gov.uk/incident-details/{prisonerNumber}',
    requiredInProduction,
  ),
},
```

**Env vars** (with dev defaults where safe; both API defaults are localhost for local dev):

| Var | Dev default in code | Value in each deployed env |
|---|---|---|
| `PRISON_API_URL` | `http://127.0.0.1:8080` | dev → `https://prison-api-dev.prison.service.justice.gov.uk`; preprod/prod set by ops |
| `PRISON_API_TIMEOUT_RESPONSE` | `10000` | as required |
| `PRISON_API_TIMEOUT_DEADLINE` | `10000` | as required |
| `MANDATORY_DRUG_TESTING_API_URL` | `http://127.0.0.1:8080` | dev → `https://mandatory-drug-testing-api-dev.hmpps.service.justice.gov.uk`; preprod/prod set by ops |
| `MANDATORY_DRUG_TESTING_API_TIMEOUT_RESPONSE` | `10000` | as required |
| `MANDATORY_DRUG_TESTING_API_TIMEOUT_DEADLINE` | `10000` | as required |
| `MANAGE_ADJUDICATIONS_URL` | `https://manage-adjudications-dev.hmpps.service.justice.gov.uk/incident-details/{prisonerNumber}` | preprod/prod set by ops; MUST contain the `{prisonerNumber}` template variable |

No new dependency required — `hmpps-connect-dps-components` (already installed) is the same package that also provides the DPS Header/Footer needed for AC #1.

---

## 4. Frontend architecture

### File plan

| File | Purpose |
|---|---|
| `server/config.ts` | Add `apis.mandatoryDrugTestingApi` block. |
| `server/data/mandatoryDrugTestingApiClient.ts` | New `RestClient` subclass; single method `getMonthlyList(prisonCode, listDate)` using `asSystem()` (see §3). |
| `server/data/mandatoryDrugTestingApiClient.test.ts` | Jest tests using `nock` (existing test pattern). |
| `server/data/index.ts` | Register the new client in `dataAccess()`. |
| `server/services/mandatoryDrugTestingService.ts` | Domain service that fetches the list and shapes it for the view (see §5). |
| `server/services/mandatoryDrugTestingService.test.ts` | Jest tests. |
| `server/services/index.ts` | Register the new service. |
| `server/interfaces/monthlyTestingList.ts` | TypeScript types for the API response and view models. |
| `server/middleware/permissions/populateUserPermissions.ts` | See §3. |
| `server/middleware/permissions/requirePermissions.ts` | See §3. |
| `server/middleware/permissions/index.ts` | Barrel export. |
| `server/interfaces/hmppsUser.ts` | Add `UserPermissionLevel` enum + `permission` field. |
| `server/middleware/populateCaseLoad.ts` (or extend `setUpCurrentUser`) | **Superseded** — use the packaged `retrieveCaseLoadData` middleware from `@ministryofjustice/hmpps-connect-dps-components` wired directly in `app.ts` (see §3). No new file needed. |
| `server/routes/mdtList.ts` | New router with `GET /mdt-list`. |
| `server/routes/index.ts` | Mount `mdtList` router. |
| `server/views/pages/mdtList.njk` | Page template; extends existing DPS layout. |
| `server/views/partials/mdt/mainListTable.njk` | Main list MOJ Sortable table partial. |
| `server/views/partials/mdt/reserveListTable.njk` | Reserve list Table partial (non-sortable). |
| `server/views/partials/mdt/summaryBlocks.njk` | Three summary blocks (Completed / Releasing this month / Tested on weekend). |
| `server/views/partials/mdt/detailsBlock.njk` | Details "How are the testing lists ordered?" content. |
| `server/views/pages/service-not-authorised.njk` | Shown by `requirePermissions` when level insufficient. |
| `integration_tests/mdt-list/*.spec.ts` | Playwright tests covering US1–US7. |

### Component library

Strictly:

- **MOJ Design System** — Sortable table (main list), Tag (Statuses on both tabs), plus any MOJ patterns for pagination if they exist. Package: `@ministryofjustice/frontend` (already installed at `^9.0.0`).
- **GOV.UK Design System** — Tabs, Details, Button, Breadcrumbs, Pagination. Package: `govuk-frontend` (already installed at `^6.4.0`).
- **DPS chrome** — DPS Header & Footer via `@ministryofjustice/hmpps-connect-dps-components` (already installed at `6.3.3`) so the page matches Official Visits and the wider DPS estate.

### Nunjucks setup

Extend `server/utils/nunjucksSetup.ts` to register:

- Date formatters (`DD Mon YYYY`, `Month YYYY`).
- `hasPermission` filter.
- `mainListSortComparator` and `naturalLocationSort` helpers (or compute sort server-side per request and pass the ordered array to the template).

### Client-side JS

The MOJ Sortable table ships its own JS. It should be initialised via the standard `initAll()` from `@ministryofjustice/frontend` in `assets/js/index.ts`. No other client JS required by this feature.

---

## 5. Service-layer shaping

`MandatoryDrugTestingService.getMonthlyView(prisonCode, listDate, viewerPermission)` should:

1. Fetch the list via the API client.
2. Produce a `MainListViewModel` and `ReserveListViewModel`:
   - Compute Status Tag (colour + text) per row.
   - Compute Action cell (see FR-018) using `viewerPermission` — RO users see "No action needed" even on "Not started" rows.
   - Compute the three summary counts (see FR-023).
   - Build the Main-list VIEW dataset by concatenating `mainList[]` with `reserveList.filter(r => r.promoted === true)`, tagging each row with `originalList: "Main" | "Reserve"` for downstream rendering and sorting.
   - Compute the sorted, paginated Main-list slice using the requested sort (from query string). Default order: originally-selected Main entries first (API order), then promoted reserves in `listSelectionNumber` ascending.
   - Preserve the Reserve tab as-returned (the whole `reserveList`), ordered by `listSelectionNumber` asc.
3. Return a single view model object the template can render.

Keep all shaping and sort logic in the service layer for testability; the route stays a thin controller and the Nunjucks template stays presentational.

---

## 6. Testing plan (TDD per constitution)

- **Unit (Jest)**
  - `mandatoryDrugTestingApiClient.test.ts` — happy path, 5xx, timeout.
  - `mandatoryDrugTestingService.test.ts` — status → tag mapping, action-per-role, summary-count rules (Completed / Releasing this month / Tested on weekend), sort semantics per column (incl. natural-alphanumeric on Location and the compound Last-selected-month rule), reserves-participate-in-sort (no sticky positioning), promoted-reserve action rule ("Record test" only for earliest-promoted still-untested reserve; "Test previous reserve first" for later ones — overrides role gate), "no more reserves" case.
  - `populateUserPermissions.test.ts` — role → permission mapping.
  - `requirePermissions.test.ts` — 200 / redirect behaviour.
- **Integration / e2e (Playwright)** — one per user story:
  - US1 view page.
  - US2 sort each column.
  - US3 reserve tab renders correctly with both statuses.
  - US4 promotion flow end-to-end.
  - US5 record-test entry point visible for RW/RWU, absent for RO.
  - US6 Details expands and shows metadata table.
  - US7 DPS chrome, URL, page title, buttons present.
- **Accessibility** — axe-core scan (already in CI stack per constitution) MUST pass on `/mdt-list` with zero critical/serious issues.

Coverage threshold: 90% lines (per `mdt-tech-stack.md`).

---

## 7. Open questions to resolve during planning

**Resolved 2026-09-09** (see §1 sample response and §2 mapping):

- ✅ `testedStatus` is a nullable boolean (`true` = Sample taken, `false` = Unable to test, `null` = Not started).
- ✅ Promotion is signalled by a `promoted: boolean` field on reserve entries. Clarified 2026-09-10: `listType` on any API entry is fully determined by which array it lives in (`mainList` → `"M"`, `reserveList` → `"R"`); reserves are NEVER duplicated into `mainList`. The FE builds the Main-list VIEW by concatenating `mainList[]` with `reserveList.filter(r => r.promoted === true)`.
- ✅ `prisoner.location` (was `cellLocation`) displayed verbatim (any value valid, incl. `"RECP"`); natural alphanumeric sort.
- ✅ CRD fallback text = "No data available".
- ✅ Package version for `hmpps-connect-dps-components` confirmed as `6.3.3` (already installed).
- ✅ **Reason lookup endpoint** — updated 2026-09-10: shape is `[{ code, description }]` (no `url` field). Fetched via `MandatoryDrugTestingApiClient.getTestedReasons()`, cached per-process (5 min TTL). The adjudication out-link is FE-owned via `MANAGE_ADJUDICATIONS_URL` env var and applied only when the row's `reasonNotTested` code is `REFUSE`.
- ✅ **Terminology sign-off** (decided 2026-09-09): column name is **"Last selected month"** and the reserve status Tag for a promoted reserve is **"Moved to main list"** (design screenshot supersedes the ticket wording).
- ✅ **Reserve ordering / sort** (decided 2026-09-09): promoted-reserve rows on the Main list participate in sorting on equal terms with originally-selected Main rows (no sticky positioning). To enforce the "reserves must be tested in order" rule, only the earliest-promoted still-untested reserve on the Main list gets the "Record test" action; every other promoted-and-untested reserve shows "Test previous reserve first".
- ✅ **Tested-on-weekend data source** — updated 2026-09-10: derived FE-side from `sampleTakenDate` on each `mainList` entry (count of rows where `sampleTakenDate` falls on Sat/Sun). No separate BE aggregate needed.
- ✅ **404 handling** — updated 2026-09-10: 404 for the current month → retry with the previous month (`YYYY-MM` minus one). If the retry also returns 404, render the "No lists currently exist for this prison, please contact your MDT Coordinator to generate a new list" empty state. `mainList` / `reserveList` are never returned empty — a generated list always has both populated. See `contracts/mdt-list-endpoint.md` and R-7.

**Still open**: none — all clarifications resolved.

---

## 8. Reference repo: patterns adopted

From `ministryofjustice/hmpps-transfer-scheduler-ui`:

- `server/middleware/permissions/{populateUserPermissions,requirePermissions}.ts` — role-to-permission-level pattern with a `UserPermissionLevel` enum and a `hasPermissionFilter` for templates.
- `server/interfaces/caseLoad.ts` — caseload data-shape used to populate `activeCaseLoadId` (though for this feature we consume the packaged `retrieveCaseLoadData` middleware directly; the ref repo's file is a useful shape reference only).
- `server/middleware/populatePrisonerDetails.ts` — pattern for populating per-request context via middleware.
- `customRestClient.ts` — reference for any client-behaviour extensions beyond `hmpps-rest-client`'s default.

---

## 9. Removal of the `ExampleApi` scaffold

The `ExampleApi` scaffold that ships in the boilerplate is not needed by this or any planned feature and MUST be removed as part of this feature's implementation to keep the codebase clean. Files/edits:

**Delete**
- `server/data/exampleApiClient.ts`
- `server/data/exampleApiClient.test.ts`
- `server/services/exampleService.ts`
- `server/services/exampleService.test.ts`

**Edit — `server/config.ts`**
- Remove the `apis.exampleApi` block. The `MANDATORY_DRUG_TESTING_API_*` block from §1 takes its place.

**Edit — `server/data/index.ts`**
- Remove the `ExampleApiClient` import, its construction in `dataAccess()`, and its export.
- Add construction of `MandatoryDrugTestingApiClient` in the same place, passing the existing `hmppsAuthClient`.

**Edit — `server/services/index.ts`**
- Remove the `ExampleService` import and its construction.
- Add construction of `MandatoryDrugTestingService`.

**Edit — `server/routes/index.ts`**
- Remove the `exampleService` destructuring and any references to `Page.EXAMPLE_PAGE`.
- Mount the new `mdtList` router.

**Edit — `server/services/auditService.ts` (if present)**
- Remove `Page.EXAMPLE_PAGE` enum entry; add `Page.MDT_LIST` or the equivalent for this feature.

**Edit — `server/views/pages/index.njk`**
- Either delete (if there is no landing page for this feature) or replace its body with a redirect / link to `/mdt-list`. Decision deferred to plan.

**Test cleanup**
- Delete `server/data/exampleApiClient.test.ts` and `server/services/exampleService.test.ts`.
- Update any `server/routes/index.test.ts` cases that reference the example page.

Verification after removal: `npm run typecheck` and `npm run test` must both pass with zero references to `ExampleApi*`, `exampleApi*`, or `Example Api` remaining in the tree (grep gate in CI is not required; a manual grep at PR time is sufficient).
