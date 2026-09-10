---
description: "Task list for feature 001-prisoner-testing-lists — MDT list page"
---

# Tasks: MDT list page (`/mdt-list`)

**Input**: Design documents from `/specs/001-prisoner-testing-lists/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `research/technical-brief.md`.

**Tests**: TESTS ARE INCLUDED. Constitution Principle I mandates TDD with ≥ 90% line coverage for this feature; every implementation task in every user story is preceded by a failing-test task.

**Organization**: Grouped by user story (US1–US7 from `spec.md`). All user stories can be implemented against a mocked API once Phase 2 is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]…[US7]` for user-story-phase tasks; setup / foundational / polish tasks have NO story label
- File paths shown are absolute-from-repo-root and match `plan.md` § Project Structure

## Path Conventions

Single-project Express + Nunjucks SSR:
- Server code: `server/`
- Views: `server/views/`
- Integration tests: `integration_tests/`
- Feature spec artifacts: `specs/001-prisoner-testing-lists/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configure the environment, wire APIs into config, remove the ExampleApi scaffold. No behavioural change until Phase 3+ but everything downstream depends on these landing first.

- [ ] T001 Add `apis.prisonApi` config block in `server/config.ts` per `research/technical-brief.md` §3: env vars `PRISON_API_URL` (localhost default `http://127.0.0.1:8080`), `PRISON_API_TIMEOUT_RESPONSE`/`PRISON_API_TIMEOUT_DEADLINE`, `AgentConfig`, `healthPath: '/health/ping'`.
- [ ] T002 Add `apis.mandatoryDrugTestingApi` config block in `server/config.ts` per `research/technical-brief.md` §3: env vars `MANDATORY_DRUG_TESTING_API_URL` (localhost default `http://127.0.0.1:8080`), `MANDATORY_DRUG_TESTING_API_TIMEOUT_RESPONSE`/`DEADLINE`, `AgentConfig`, `healthPath: '/health/ping'`.
- [ ] T003 Add `manageAdjudications.urlTemplate` config block in `server/config.ts`: env var `MANAGE_ADJUDICATIONS_URL` with dev default `https://manage-adjudications-dev.hmpps.service.justice.gov.uk/incident-details/{prisonerNumber}`. Validate that the value contains the `{prisonerNumber}` placeholder at boot.
- [ ] T004 Remove `apis.exampleApi` block and all associated env vars from `server/config.ts` and `feature.env`/env templates per `research/technical-brief.md` §9.
- [ ] T005 [P] Delete `server/data/exampleApiClient.ts` and `server/data/exampleApiClient.test.ts`.
- [ ] T006 [P] Delete `server/services/exampleService.ts` and `server/services/exampleService.test.ts`.
- [ ] T007 Remove `ExampleApiClient` from `server/data/index.ts` and `ExampleService` from `server/services/index.ts` (edit the barrel/factory exports and any dependency-injection wiring).
- [ ] T008 Remove any `Page.EXAMPLE_PAGE` (or equivalent) enum member and its route registration in `server/routes/index.ts`; delete/replace the example view under `server/views/pages/`.
- [ ] T009 Wire `retrieveCaseLoadData({ logger, prisonApiConfig: config.apis.prisonApi })` from `@ministryofjustice/hmpps-connect-dps-components` into `server/app.ts` per `research/technical-brief.md` §3, mounted after session/auth but before route mounting.
- [ ] T010 Add `MANDATORY_DRUG_TESTING_API_URL`, `MANDATORY_DRUG_TESTING_API_TIMEOUT_RESPONSE`, `MANDATORY_DRUG_TESTING_API_TIMEOUT_DEADLINE`, `PRISON_API_URL`, `PRISON_API_TIMEOUT_RESPONSE`, `PRISON_API_TIMEOUT_DEADLINE`, `MANAGE_ADJUDICATIONS_URL` to the repo's env-var manifests (`feature.env.example`, `helm_deploy/values*.yaml`, Kubernetes secret templates, README env-vars table).
- [ ] T011 [P] Confirm `@ministryofjustice/hmpps-auth-clients` (already used by `asSystem()`) is present in `package.json` at the version documented in `research/technical-brief.md` §3; add/update if missing.
- [ ] T012 [P] Add / confirm `SYSTEM_CLIENT_ID` and `SYSTEM_CLIENT_SECRET` are read by the existing auth-clients wiring (no code change expected — verify by tracing `asSystem()` back to config).

**Checkpoint**: `npm run typecheck`, `npm run lint`, and `npm test` all pass (the ExampleApi test suites are gone, no orphan references remain).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The API client, service, roles middleware, permission enum, interfaces, and Nunjucks filter — the primitives every user story sits on top of. Nothing user-facing yet.

**⚠️ CRITICAL**: No user-story task can begin until this phase is complete.

### Domain interfaces

- [ ] T013 [P] Create `server/interfaces/monthlyTestingList.ts` with `MonthlyTestingList`, `TestingListEntry`, `Prisoner` types matching `data-model.md` §1 exactly (nullable-boolean `testedStatus`; `listType: "M" | "R"`; `promoted: boolean | null`; `sampleTakenDate`/`lastTestedDate` as `string | null`; `Prisoner.location` string).
- [ ] T014 [P] Create `server/interfaces/testedReason.ts` with `TestedReason = { code: string; description: string }` per `data-model.md` §2 (no `url` field).

### API client + tests

- [ ] T015 Create failing test file `server/data/mandatoryDrugTestingApiClient.test.ts` covering (per `contracts/mdt-list-endpoint.md` verification list): 200 happy path, 404 → `null`, 500 → reject, timeout → reject, `Authorization: Bearer` header present, URL-encoding of path params. Include tests for `getTestedReasons()`: 200 happy path returns `TestedReason[]`, 404 → empty array, 5xx → reject.
- [ ] T016 Create `server/data/mandatoryDrugTestingApiClient.ts` extending `RestClient`, calling `asSystem()` for the token, with methods:
  - `getMonthlyList(prisonCode: string, listDate: string): Promise<MonthlyTestingList | null>` — path `/prisons/{prisonCode}/mandatory-drug-testing-lists/{listDate}`, URL-encoding both params, resolving `null` on 404.
  - `getTestedReasons(): Promise<TestedReason[]>` — path `/reference-data/tested-reasons`, resolving `[]` on 404.
  Register the client in `server/data/index.ts`. All tests from T015 MUST pass.

### Roles middleware + permission enum + tests

- [ ] T017 [P] Create `server/middleware/permissions/userPermissionLevel.ts` exporting the enum `UserPermissionLevel = 'VIEW_ONLY' | 'MANAGE' | 'FORBIDDEN'` per `contracts/ui-contract.md` § Access control.
- [ ] T018 Create failing test file `server/middleware/permissions/populateUserPermissions.test.ts`: given a user with `MANDATORY_DRUG_TESTING_RO` → `res.locals.permissions === 'VIEW_ONLY'`; with `MANDATORY_DRUG_TESTING_RW` or `MANDATORY_DRUG_TESTING_RWU` → `'MANAGE'`; with none of these → `'FORBIDDEN'`; no user → `'FORBIDDEN'`.
- [ ] T019 Create `server/middleware/permissions/populateUserPermissions.ts` that inspects `res.locals.user.userRoles` (or the repo's existing convention) and sets `res.locals.permissions`. All tests from T018 MUST pass.
- [ ] T020 Create failing test file `server/middleware/permissions/requirePermissions.test.ts`: with `permissions === 'VIEW_ONLY'` or `'MANAGE'` and the required level in `['VIEW_ONLY', 'MANAGE']` → calls `next()`; with `'FORBIDDEN'` → renders 403 DPS "not authorised" page; missing `res.locals.permissions` → renders 500 (config bug).
- [ ] T021 Create `server/middleware/permissions/requirePermissions.ts` as a factory `requirePermissions(...allowed: UserPermissionLevel[])`. All tests from T020 MUST pass.
- [ ] T022 Mount `populateUserPermissions` in `server/app.ts` after `setUpCurrentUser` and before route mounting.

### Nunjucks role-filter + tests

- [ ] T023 Create failing test file `server/utils/hasPermissionFilter.test.ts`: filter returns `true`/`false` for each `UserPermissionLevel` against each required level (as per `data-model.md` §4 role gating rule).
- [ ] T024 Create `server/utils/hasPermissionFilter.ts` and register it as a Nunjucks filter alongside the repo's other filter registrations. All tests from T023 MUST pass.

### Natural-alphanumeric compare util + tests

- [ ] T025 [P] Create failing test file `server/services/utils/naturalAlphanumericCompare.test.ts` covering the cases enumerated in `data-model.md` §4 and §5: `"A-03-091"` vs `"A-03-9"`, `"RECP"` vs `"A-01-001"`, empty string, single token, mixed case, equal-shape ties.
- [ ] T026 [P] Create `server/services/utils/naturalAlphanumericCompare.ts` implementing the tokeniser + comparator per `data-model.md` §4. All tests from T025 MUST pass.

### Route scaffold (empty controller)

- [ ] T027 Create `server/routes/mdtList/mdtListRouter.ts` mounting a single `GET /` handler protected by `requirePermissions('VIEW_ONLY', 'MANAGE')`; register the router at path `/mdt-list` in `server/routes/index.ts`.
- [ ] T028 Add a `/` → `/mdt-list` 302 redirect route and delete the placeholder content of `server/views/pages/index.njk` per `research.md` R-2.

**Checkpoint**: `GET /mdt-list` returns 200 with a minimal shell (or the empty state), 403 for users without a permitted role, and unit tests for T013–T028 all green. `GET /` redirects to `/mdt-list`.

---

## Phase 3: User Story 1 — View this month's main list (Priority: P1) 🎯 MVP

**Goal**: A signed-in officer at an establishment with a populated list can see the correct caption, `<h1>`, the Main list tab active by default, and every prisoner shaped into the seven columns of `FR-003` (Prisoner, Original list, Location, Release date (CRD), Last selected month, Status, Action) plus the three summary blocks of `FR-024`.

**Independent Test**: Load `/mdt-list` for a signed-in officer at an establishment with a populated monthly list (mocked). Verify caption, `<h1>`, Main list tab active, all rows shown, columns correct, summary blocks correct. Corresponds to `spec.md` US1 Acceptance Scenarios 1–4.

### Tests for User Story 1 ⚠️

Write these first — they MUST fail before implementation.

- [ ] T029 [P] [US1] Failing unit test: `server/services/mandatoryDrugTestingService.test.ts` (initial suite) — `getMonthlyView(prisonCode, listDate, viewerPermission)` returns a `MdtListView` whose `caption`, `heading`, `mainRows`, `reserveRows`, `summary`, `detailsMeta`, and `permissions` are populated correctly given a canonical API response. Includes: main-list rows have `originalList === "Main"` sourced from `mainList[]`; view is built by concatenating `mainList[]` with `reserveList.filter(r => r.promoted === true)` (with `originalList === "Reserve"` on the latter).
- [ ] T030 [P] [US1] Failing unit test extending `mandatoryDrugTestingService.test.ts`: summary counts — `Completed` (any `mainRows` entry with `testedStatus !== null`), `Releasing this month` (`releaseDate` in same `YYYY-MM` as list month, edge cases 1st/last day), `Tested on weekend` (`sampleTakenDate` on Sat/Sun; Friday excluded; null excluded).
- [ ] T031 [P] [US1] Failing unit test: `server/routes/mdtList/mdtListController.test.ts` — controller populates locals from `res.locals.user`, `res.locals.permissions`, and the service view model, then renders `pages/mdtList/index.njk`.
- [ ] T032 [P] [US1] Failing Playwright test in `integration_tests/mdt-list.spec.ts`, scenario "US1 — main list renders correctly": mock the API to return a canonical list, sign in as RO, assert caption `HMP {name}`, `<h1>` = `{Month YYYY}`, Main tab active, `data-testid="mdt-main-table"` shows the expected number of rows with the seven columns per FR-003.

### Implementation for User Story 1

- [ ] T033 [US1] Implement `MandatoryDrugTestingService.getMonthlyView(prisonCode, listDate, viewerPermission)` in `server/services/mandatoryDrugTestingService.ts` — call `apiClient.getMonthlyList()`; on non-null result, build `MdtListView` per `data-model.md` §3 (including the `mainList + promoted reserves` concat, `originalList` derivation, default sort ordering, summary counts). Register the service in `server/services/index.ts`.
- [ ] T034 [US1] Implement `server/routes/mdtList/mdtListController.ts` — read `activeCaseLoadId` and current month (`YYYY-MM`) from `res.locals`/date, call the service, render `pages/mdtList/index.njk`. Return 500 with ERROR log if `activeCaseLoadId` is missing (per `contracts/ui-contract.md`).
- [ ] T035 [US1] Create `server/views/pages/mdtList/index.njk` — DPS Header/Footer via `hmpps-connect-dps-components`, breadcrumbs, caption (`FR-023`), `<h1>` bound to `heading`, GOV.UK Tabs skeleton with two panels `#main-list` and `#reserve-list`, `<title>MDT list - Mandatory drug testing - DPS</title>` per FR-022.
- [ ] T036 [US1] Create `server/views/pages/mdtList/_mainListTable.njk` — MOJ Sortable Table (`data-module="moj-sortable-table"`, `data-testid="mdt-main-table"`) with the seven columns of FR-003; render `prisonerName` and `prisonerNumber` stacked; format `releaseDate` as `DD Mon YYYY` or `No data available`; format `lastSelectedMonth`; render Status as a Tag; render Action per the model shape (kind + text + optional href — full role-gate handling arrives in T041). Include `data-testid`s from `contracts/ui-contract.md`.
- [ ] T037 [US1] Create `server/views/pages/mdtList/_summaryBlocks.njk` — three blocks per FR-024 with `data-testid`s `mdt-summary-completed`, `mdt-summary-releasing`, `mdt-summary-weekend`.
- [ ] T038 [US1] Embed the row dataset as `<script type="application/json" id="mdt-list-data">…</script>` in the Main panel (per `contracts/ui-contract.md` § Client-side JS data) so subsequent stories (US2 sort/pagination) can consume without re-serialising.

**Checkpoint**: `/mdt-list` renders a populated Main tab for RO/RW/RWU users; all US1 tests pass; summary blocks correct; page passes `axe-core` at zero critical/serious violations for the populated Main tab.

---

## Phase 4: User Story 2 — Sort the main list (Priority: P1)

**Goal**: All Main columns except Action are sortable ascending/descending with the sort semantics of `spec.md` US2 ACs #3–8 (natural-alphanumeric Location; grouped-then-recency Last selected month; nulls-last Release date; grouped Status; sort survives tab-switch, resets on reload). All Main rows including promoted reserves participate on equal terms (no sticky).

**Independent Test**: US2 ACs #2–11 exercised via Playwright per `quickstart.md` V-3.

### Tests for User Story 2 ⚠️

- [ ] T039 [P] [US2] Failing unit tests in `mandatoryDrugTestingService.test.ts` (extension): default-sort ordering — original Main entries first (API order), then promoted reserves by `listSelectionNumber` asc. Precomputed sort keys populated on each `MainListViewRow`: `locationSortKey`, `releaseSortKey`, `lastSelectedSortKey.group`+`.recencyMs`, `statusSortKey`. Covers compound Last-selected sort across all three groups.
- [ ] T040 [P] [US2] Failing Playwright test in `integration_tests/mdt-list.spec.ts`, scenario "US2 — sort semantics": activate each sortable header in turn, assert row order per US2 ACs #3–8; assert Action column has no sort control; assert sort survives tab switch; assert reload resets to default; assert promoted reserves participate in sort.

### Implementation for User Story 2

- [ ] T041 [US2] Extend `MandatoryDrugTestingService` (still `mandatoryDrugTestingService.ts`) to populate all sort keys on every `MainListViewRow`. Uses `naturalAlphanumericCompare` (from T026) for the Location key.
- [ ] T042 [US2] Create `assets/js/mdt-list-sort.ts` (or the repo's existing FE-assets location) — a small client-side module that reads `#mdt-list-data`, applies the current sort to the live DOM (or re-renders the tbody), updates `aria-sort` on the active header, and preserves the sort across in-page tab switches (module scope). Wire it into `webpack`/`esbuild` bundle entry per repo convention. No sort persistence across reloads.
- [ ] T043 [US2] Update `_mainListTable.njk` to render each `<th>` with `aria-sort="none"` and the MOJ Sortable-Table button markup so both keyboard and mouse activation are supported.

**Checkpoint**: All US2 tests pass; sort works with keyboard only; `aria-sort` updates correctly; sort resets on reload.

---

## Phase 5: User Story 3 — Reserve list in fixed priority order (Priority: P1)

**Goal**: Reserve tab renders the entire `reserveList` unmodified, ordered by `listSelectionNumber` asc, with the five columns of FR-004 (Order, Prisoner, Location, Last selected month, Status), NO sort controls anywhere, and status Tags `"Available as reserve"` or `"Moved to main list"` per `promoted`.

**Independent Test**: US3 ACs #1–5 exercised via Playwright per `quickstart.md` V-4.

### Tests for User Story 3 ⚠️

- [ ] T044 [P] [US3] Failing unit tests in `mandatoryDrugTestingService.test.ts`: `reserveRows` contains every entry from `reserveList[]`, ordered by `listSelectionNumber` asc; each row's `statusTag` maps `promoted === true → "Moved to main list"`, `promoted === false → "Available as reserve"`.
- [ ] T045 [P] [US3] Failing Playwright test in `integration_tests/mdt-list.spec.ts`, scenario "US3 — reserve tab renders correctly": switch to Reserve tab, assert H2 "Reserve list", intro paragraph text (verbatim from FR-004 / US3 AC #1), five columns in order, no sort controls on any header, row count = `reserveList.length`, promoted reserves still present with the "Moved to main list" Tag.

### Implementation for User Story 3

- [ ] T046 [US3] Create `server/views/pages/mdtList/_reserveListTable.njk` — plain GOV.UK Table (`data-testid="mdt-reserve-table"`) with the five columns of FR-004, no `data-module="moj-sortable-table"` attribute (so the JS never picks it up). Include the H2 "Reserve list" and the intro paragraph.
- [ ] T047 [US3] Wire `_reserveListTable.njk` into `index.njk`'s Reserve panel (`#reserve-list`).

**Checkpoint**: Reserve tab passes all US3 tests including axe-core.

---

## Phase 6: User Story 4 — Automatic replacement + action text (Priority: P1)

**Goal**: The action-rule per `data-model.md` §4 renders correctly for every row on the Main-list view: `Sample taken` → `No action needed`; `Unable to test` → `Replaced by reserve due to {description}` (link on `REFUSE`, plain text otherwise); `Not started` + Main → `Record test`; `Not started` + Reserve + earliest untested → `Record test`; `Not started` + Reserve + not earliest → `Test previous reserve first`. Promoted reserves appear in both tabs.

**Independent Test**: US4 ACs #1–7 exercised via Playwright per `quickstart.md` V-5.

### Tests for User Story 4 ⚠️

- [ ] T048 [P] [US4] Failing unit tests in `mandatoryDrugTestingService.test.ts`: action-rule cases per `data-model.md` §5 test list — originally-selected Main "Not started" → `record-test`; promoted Reserve earliest-untested → `record-test`; promoted Reserve NOT earliest → `wait-for-previous-reserve` (regardless of role); `testedStatus = true` → `no-action`; `testedStatus = false` with `REFUSE` → `replaced-by-reserve` with `href` = `config.manageAdjudications.urlTemplate` substituted with the row's `prisonerNumber`; `testedStatus = false` with `DISCH` → `replaced-by-reserve` with no `href`; unknown reason code → raw code used as `description`.
- [ ] T049 [P] [US4] Failing unit tests: reason-lookup cache — first call fetches, second call within TTL served from cache, TTL expiry refetches, 404/5xx caches an "unavailable" marker for TTL and falls through to raw-code rendering; adjudication URL for `REFUSE` still applied when reference data is unavailable.
- [ ] T050 [P] [US4] Failing Playwright test in `integration_tests/mdt-list.spec.ts`, scenario "US4 — reserve promotion, action rendering, cross-tab": seed one `REFUSE` unable-to-test + one promoted reserve; assert original row action = `Replaced by reserve due to Refused a test` as a link with `href` matching the adjudication template substituted with the row's `prisonerNumber`, `target="_blank" rel="noopener noreferrer"`; assert promoted reserve appears on Main with `Original list = Reserve` and action `Record test`; switch to Reserve tab and assert the same prisoner shows Tag `Moved to main list`, order preserved. Then seed a second `DISCH` unable-to-test + a second promoted reserve; assert earliest-promoted still shows `Record test`, later-promoted shows `Test previous reserve first` (regardless of role), and the `DISCH` original row action is plain text (no link).
- [ ] T051 [P] [US4] Failing Playwright test, scenario "US4 — no more reserves": every reserve has `promoted === true`; assert the "no reserves remain" notification appears per FR-012.

### Implementation for User Story 4

- [ ] T052 [US4] Extend `MandatoryDrugTestingService` with `lookupReason(code)` (per-process `Map` + 5-min TTL) and a `getTestedReasonsCached()` fetch wrapper. Uses `apiClient.getTestedReasons()` from T016.
- [ ] T053 [US4] Extend row shaping in `getMonthlyView()` to compute each row's `action` (per `data-model.md` §4 pseudocode) using: reason lookup, `config.manageAdjudications.urlTemplate` substitution for `REFUSE`, and the earliest-promoted-untested comparison across the built `mainRows` array. Applies to both originally-selected Main entries and promoted reserves.
- [ ] T054 [US4] Update `_mainListTable.njk` to render each action variant per the model's `kind`:
  - `"record-test"` → link with `data-testid="mdt-action-record-test"` and href = `action.href` (subject to Nunjucks role gate — RO users get "No action needed" — see T041/T024 filter).
  - `"no-action"` → text "No action needed" with `data-testid="mdt-action-no-action"`.
  - `"replaced-by-reserve"` → text (or link if `href` present) with `data-testid="mdt-action-replaced"`; when link, add `target="_blank" rel="noopener noreferrer"`.
  - `"wait-for-previous-reserve"` → text "Test previous reserve first" with `data-testid="mdt-action-wait-previous"` — NO role gate.
- [ ] T055 [US4] Add the FR-012 "no reserves remain" notification banner in `index.njk` when every `reserveList` entry has `promoted === true`.

**Checkpoint**: All US4 tests pass; adjudication link opens in a new tab; cross-tab consistency verified.

---

## Phase 7: User Story 5 — Record-test entry point respects role (Priority: P2)

**Goal**: For "Not started" rows the RW/RWU roles see the `Record test` link; RO sees `No action needed`. The "Test previous reserve first" rule from US4 overrides role gating.

**Independent Test**: US5 ACs #1–7 via Playwright per `quickstart.md` V-6.

### Tests for User Story 5 ⚠️

- [ ] T056 [P] [US5] Failing Playwright test in `integration_tests/mdt-list.spec.ts`, scenario "US5 — role gate on Record test": sign in as RW/RWU, assert `Record test` link present on originally-selected "Not started" row and on earliest-promoted-untested reserve; sign in as RO, assert same rows now show `No action needed`; assert "Test previous reserve first" is unchanged regardless of role; assert `Record test` link resolves to the recording-journey stub URL for that specific `prisonerNumber`.

### Implementation for User Story 5

- [ ] T057 [US5] In `_mainListTable.njk`, wrap the `Record test` render in `{% if permissions | hasPermission('MANAGE') %}` (from T024). Fallback branch renders "No action needed" with `data-testid="mdt-action-no-action"`. `wait-for-previous-reserve` MUST NOT be inside this gate.
- [ ] T058 [US5] Confirm the `href` for `Record test` uses a placeholder route `/mdt-list/record/{entryId}` that returns 501 or the standard "not yet built" placeholder — the recording journey itself is out of scope for this feature (per US5 story text). Keep the anchor keyboard-focusable.

**Checkpoint**: All US5 tests pass; role gate does not affect "Test previous reserve first".

---

## Phase 8: User Story 6 — "How are the testing lists ordered?" details (Priority: P2)

**Goal**: A GOV.UK Details component labelled "How are the testing lists ordered?" expands to show the metadata table (six rows per FR-024) and three explanatory body sections.

**Independent Test**: US6 ACs #1–3 via Playwright per `quickstart.md` V-7.

### Tests for User Story 6 ⚠️

- [ ] T059 [P] [US6] Failing unit test in `mandatoryDrugTestingService.test.ts`: `MdtListView.detailsMeta` populated with the six rows per FR-024; where the underlying data is not available in this feature (e.g. seed / population), value = "—" and a `data-pending` marker is set.
- [ ] T060 [P] [US6] Failing Playwright test, scenario "US6 — details block": click the summary, assert the six-row metadata table appears with the expected labels, assert the three body sections (List generation / Reserves / Other testing methods) render the FR-024 body copy verbatim, assert Enter and Space toggle correctly, assert `aria-expanded` updates.

### Implementation for User Story 6

- [ ] T061 [US6] Create `server/views/pages/mdtList/_detailsBlock.njk` — GOV.UK Details with `data-testid="mdt-details"`; contains the metadata table and the three body sections whose copy is verbatim from FR-024.
- [ ] T062 [US6] Extend `getMonthlyView()` to populate `detailsMeta` (six labelled rows) — where the API does not yet expose a value, populate `"—"` with the pending marker.
- [ ] T063 [US6] Wire `_detailsBlock.njk` into `index.njk` above the tabs per `contracts/ui-contract.md` landmarks.

**Checkpoint**: All US6 tests pass; details block is keyboard-toggleable.

---

## Phase 9: User Story 7 — Page shell, chrome, secondary buttons (Priority: P2)

**Goal**: Page uses DPS Header/Footer via connect-dps-components (same visual treatment as Official Visits), Breadcrumbs, and two secondary buttons "View previous months" and "Print testing list" (target behaviour out-of-scope).

**Independent Test**: US7 ACs #1–5 via Playwright per `quickstart.md` V-1.

### Tests for User Story 7 ⚠️

- [ ] T064 [P] [US7] Failing Playwright test, scenario "US7 — chrome + secondary buttons": assert DPS Header/Footer are present with the standard classes/elements (parity with Official Visits page can be a visual-diff or attribute check); assert `<title>MDT list - Mandatory drug testing - DPS</title>`; assert Breadcrumbs point back to the MDT landing; assert both secondary buttons exist, are keyboard-reachable, are correctly labelled, and are focusable — but do not require them to navigate anywhere.

### Implementation for User Story 7

- [ ] T065 [US7] Confirm `index.njk` extends the repo's connect-dps-components layout template (Header/Footer rendered via `res.locals.frontendComponents`). Add the `frontendComponents` middleware if not already global.
- [ ] T066 [US7] Add the GOV.UK Breadcrumbs component to `index.njk` pointing at the MDT landing.
- [ ] T067 [US7] Add the two `<a class="govuk-button govuk-button--secondary">` buttons ("View previous months" and "Print testing list") in a `govuk-button-group` between the Details block and the Tabs per `contracts/ui-contract.md`.

**Checkpoint**: All US7 tests pass; visual chrome matches other DPS services.

---

## Phase 10: 404 previous-month fallback + empty state (research.md R-7 / FR-007)

**Goal**: On current-month 404 the FE retries once with the previous month; on that 200, renders the previous month with a fallback banner and `<h1>` set to the fallback month; on that 404, renders the exact empty-state message.

**Independent Test**: `quickstart.md` V-8a and V-8b.

### Tests

- [ ] T068 [P] Failing unit tests in `mandatoryDrugTestingService.test.ts`: current-month 200 → returns list, `fallbackNotice = null`, `emptyState = false`; current-month 404 + previous-month 200 → returns previous list with populated `fallbackNotice` and `heading` = previous month; current-month 404 + previous-month 404 → `emptyState = true` with the FR-007 message; current-month 5xx → rejects (no fallback); previous-month 5xx after current-month 404 → rejects. Month arithmetic edge cases (Dec → Nov, Jan → prev Dec).
- [ ] T069 [P] Failing Playwright test, "V-8a fallback": mock current 404 + previous 200, assert HTTP 200, banner appears, `<h1>` = previous month, tabs render normally.
- [ ] T070 [P] Failing Playwright test, "V-8b empty state": mock both 404s, assert HTTP 200, no tabs, GOV.UK panel with the EXACT text `No lists currently exist for this prison, please contact your MDT Coordinator to generate a new list`.

### Implementation

- [ ] T071 Extend `MandatoryDrugTestingService.getMonthlyView()` to orchestrate the fallback: current-month first; if `null`, previous-month; if that also `null`, set `emptyState: true`; if previous-month returned a list, set `fallbackNotice` and use the previous month for `heading`.
- [ ] T072 Update `index.njk` to render the notification banner when `fallbackNotice` is non-null, and to render an empty-state panel (no tabs) with the exact FR-007 message when `emptyState === true`. Include `data-testid`s for both.

**Checkpoint**: All fallback + empty-state tests pass.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility hardening, coverage top-up, error surface polish, docs.

- [ ] T073 [P] Create `integration_tests/mdt-list.a11y.spec.ts` running `@axe-core/playwright` on:
  1. Populated Main tab (US1 mock)
  2. Populated Reserve tab
  3. Fallback banner variant (T069 mock)
  4. Empty state (T070 mock)
  Assert zero critical or serious violations in every variant.
- [ ] T074 [P] Add a Playwright keyboard-only navigation test covering the tab-order documented in `contracts/ui-contract.md` (caption → h1 → Details summary → View previous months → Print testing list → Main tab → Reserve tab → sortable headers → first row → pagination controls).
- [ ] T075 Add a `data-testid="mdt-main-pagination"` MOJ Pagination component to `_mainListTable.njk` at 50 rows per page per FR-019; add unit + Playwright tests for pagination behaviour (page 1 default, page slice on nav, sort applied before pagination not after).
- [ ] T076 Add correlation-ID + structured JSON logging around every MDT API call and reference-data lookup (per constitution Principle VIII / `plan.md`).
- [ ] T077 [P] Update the repo `README.md` and `CHANGELOG` (or equivalent) with the new env vars from T010 and a note on the `/mdt-list` route + role model.
- [ ] T078 [P] Run `npm run test:ci` and confirm ≥ 90% line coverage for `server/services/mandatoryDrugTestingService.ts`, `server/data/mandatoryDrugTestingApiClient.ts`, `server/routes/mdtList/*`, and `server/middleware/permissions/*` per constitution Principle I.
- [ ] T079 Run the full `quickstart.md` V-1 … V-9 checklist manually as smoke against the dev stack; note any deviations and open follow-up tickets — do not block on missing BE-only data (empty-string values, `—`, or reference-data-unavailable rendering are acceptable per §7 open items marked resolved).
- [ ] T080 Remove any dead code or TODOs left from the ExampleApi removal; run `npm run lint` and `npm run typecheck` — must be zero errors, zero new warnings.

**Final checkpoint**: CI green (`test:ci`, `int-test`, `security_audit`, `npm audit --production`), coverage ≥ 90 %, all a11y variants zero critical/serious, dev env smoke-tested via quickstart.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup**: No dependencies; can start immediately.
- **Phase 2 Foundational**: Depends on Phase 1 completion. BLOCKS all user-story phases.
- **Phase 3 (US1)**: Depends on Phase 2. MVP target.
- **Phase 4 (US2)**: Depends on Phase 3 (uses the Main table markup + data script).
- **Phase 5 (US3)**: Depends on Phase 2 only — independent of US1/US2 rendering.
- **Phase 6 (US4)**: Depends on Phase 3 (Main table) and Phase 5 (Reserve tab, for cross-tab assertions); pulls in reason-lookup cache.
- **Phase 7 (US5)**: Depends on Phase 6 (Action rendering exists).
- **Phase 8 (US6)**: Depends on Phase 2 + `index.njk` from Phase 3.
- **Phase 9 (US7)**: Depends on Phase 3 (page shell in place).
- **Phase 10 (fallback + empty state)**: Depends on Phase 3 (view model + shell exist to modify).
- **Phase 11 Polish**: Depends on all user-story phases + Phase 10.

### Within a story

- Tests MUST be written and MUST fail before the corresponding implementation is written.
- Interfaces / types → API client → Service → Controller → View templates → FE JS.
- No cross-story imports that break independent testability.

### Parallel opportunities

- Phase 1: T005, T006, T011, T012 in parallel; T004 is a single-file edit but can chain with T007–T008.
- Phase 2: T013, T014, T017, T025+T026 can start in parallel with the API-client test/impl pair.
- All test tasks marked `[P]` within a story can run in parallel (different files).
- After Phase 2 checkpoint, US1/US3/US6/US7 can proceed by different developers in parallel; US2 waits for US1 (needs the table markup) and US4 waits for US3 (needs the reserve tab) — see plan above.

---

## Parallel example: User Story 1

```bash
# All US1 tests can be written in parallel (different files):
Task: T029 — service unit tests in server/services/mandatoryDrugTestingService.test.ts
Task: T030 — summary-counts tests in the same file (different describe block; safe to author together)
Task: T031 — controller tests in server/routes/mdtList/mdtListController.test.ts
Task: T032 — Playwright US1 scenario in integration_tests/mdt-list.spec.ts

# Implementation is sequential within the story:
T033 → T034 → (T035 || T036 || T037) → T038
```

---

## Implementation Strategy

### MVP scope

**Phases 1 + 2 + 3 (US1)** = the MVP. Delivers the primary daily task: a signed-in officer at an establishment sees the correct month's list, correctly shaped, with the DPS chrome and correct role-gated read access. Empty-state and fallback (Phase 10) SHOULD ship with the MVP because a mid-month first-deploy will otherwise show a broken empty page for any establishment that has not yet had a list generated.

### Recommended incremental delivery

1. Phase 1 + Phase 2 → Foundation ready (nothing user-visible yet).
2. Phase 3 (US1) → MVP demo: view populated list.
3. Phase 10 (fallback + empty state) → safe to release to any environment.
4. Phase 5 (US3) → Reserve tab (independent, quick win).
5. Phase 6 (US4) → Replacement rule live end-to-end.
6. Phase 4 (US2) → Sorting.
7. Phase 7 (US5) → Role-gated Record test link.
8. Phase 8 (US6) → Details block.
9. Phase 9 (US7) → Chrome + secondary buttons polish.
10. Phase 11 → Polish + a11y + coverage.

### Parallel team strategy

With three developers post-Phase-2:
- Dev A: US1 (MVP path) → US2 (sort) → US7 (chrome polish).
- Dev B: US3 (Reserve) → US4 (Replacement / action rule) → US5 (role gate).
- Dev C: US6 (Details) → Phase 10 (fallback / empty state) → Phase 11 (a11y + coverage).

---

## Traceability

Every task cites the source spec doc it delivers against — no vague tasks. Every user-story task carries an `[US#]` label; every non-story task has none. Every file path is absolute-from-repo-root and matches `plan.md` § Project Structure.

## Notes

- `[P]` = different files, no incomplete-task dependencies.
- Test tasks precede their implementation tasks; tests MUST fail before the implementation is written.
- Commit after each task or logical group (e.g. a test + its implementation).
- Stop at each phase checkpoint to validate the story independently before starting the next.
- Avoid: same-file conflicts in `[P]` tasks; cross-story imports that break independence; any BE code (this repo is FE-only for this feature).
