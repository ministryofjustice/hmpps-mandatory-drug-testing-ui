# Implementation Plan: Mandatory Drug Testing list page

**Branch**: `001-prisoner-testing-lists` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-prisoner-testing-lists/spec.md`

## Summary

Build a new `/mdt-list` page in the `hmpps-mandatory-drug-testing-ui` Express + Nunjucks service that displays the current month's Mandatory Drug Testing lists (Main and Reserve) for the signed-in officer's active establishment, as two GOV.UK Tabs. Data is fetched server-side from the MDT API (`GET /prisons/{prisonCode}/mandatory-drug-testing-lists/{listDate}`) using an `asSystem()` client-credentials token from HMPPS Auth. A second reference-data endpoint (`GET /reference-data/tested-reasons`) supplies display text and out-links (adjudication service) for the "Unable to test" reason codes. The page is gated by three roles (`MANDATORY_DRUG_TESTING_RO` view-only, `MANDATORY_DRUG_TESTING_RW`/`RWU` writer), rendered with MOJ and GOV.UK components only, and made accessible to WCAG 2.1 AA. The existing `ExampleApi` scaffold is removed as part of this feature.

Full domain/view mapping, auth/roles rationale, sort semantics, promoted-reserve action rule, ExampleApi removal checklist, and TDD test plan already captured in `research/technical-brief.md` — this plan links to it rather than duplicating.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node 24 (per `package.json` `engines`)

**Primary Dependencies**:
- Web framework: Express + Nunjucks (SSR)
- HMPPS auth: `@ministryofjustice/hmpps-auth-clients` 3.0.0 (client-credentials via `AuthenticationClient`; consumed via `asSystem()`)
- HMPPS REST client: `@ministryofjustice/hmpps-rest-client` 2.2.0 (`RestClient` base + `asSystem()` helper)
- DPS chrome + caseload: `@ministryofjustice/hmpps-connect-dps-components` 6.3.3 (DPS Header/Footer + `retrieveCaseLoadData` middleware — both already installed)
- Component libraries: `@ministryofjustice/frontend` 11.x (MOJ — Notification badge, Sortable table, primary UI), `govuk-frontend` 6.4.0 (GOV.UK fallback — Tabs, Details, Table, Tag, Button, Breadcrumbs)

**Storage**: N/A (stateless UI; all persistence lives in the MDT API service)

**Testing**:
- Unit: **Jest** with `nock` for HTTP-client mocking (already in repo)
- e2e / integration: **Playwright** (already configured in this repo — accepted substitute for Cypress under the constitution/tech-stack rules)
- Accessibility: **axe-core** (in the existing e2e stack per `mdt-tech-stack.md`)
- Coverage threshold: **90% lines** (per `.specify/memory/mdt-tech-stack.md`)

**Target Platform**: HMPPS Cloud Platform (Kubernetes) behind DPS SSO; browsers per GDS supported-browser list.

**Project Type**: web-service (SSR frontend). Single-project layout — no separate backend workspace; the BE that owns MDT data is a different service (`hmpps-mandatory-drug-testing-api`, out of repo).

**Performance Goals**:
- Server-rendered page TTFB ≤ 800ms at p95 for a warm process (matches SC-001 "2s" client-perceived target with headroom for network + render).
- MDT API call ≤ 500ms at p95 for a monthly list (≈ tens to low hundreds of prisoners; see Scale/Scope).
- Sort/re-render on the client ≤ 100ms for 200 rows (natural-alphanumeric Location sort must not become a bottleneck).

**Constraints**:
- WCAG 2.1 AA — zero critical/serious axe-core violations on `/mdt-list`.
- MOJ components first, GOV.UK components only where MOJ has no equivalent (Tabs, Details, Tag, Breadcrumbs, Button, Table).
- No PII in logs, no secrets in source (secrets via existing HMPPS env-var flow / Kubernetes Secrets).
- Client-side JS budget kept small — the sortable-table interaction is progressive-enhancement on the MOJ Sortable Table pattern; the page MUST render usefully without JS.
- Pagination: 50 rows per page (FR-019) — server-side or client-side is TBD in Phase 0 (see research question R-1).

**Scale/Scope**:
- Concurrent users: low tens across the estate at any given moment.
- Rows per request: main list typically 20–150 prisoners, reserve list typically 10–30 (heuristic; confirmed at implementation time from BE sample data).
- Single feature-page + 1 externally-visible reference (adjudication service link) + 2 API endpoints consumed.

## Constitution Check

*GATE: Passes before Phase 0 research. Re-checked after Phase 1 design (see end of file).*

- [x] **TDD (Principle I)**: Every unit and Playwright test listed in `research/technical-brief.md` §6 (and expanded in this plan's Phase 1 test-list) MUST be written Red-Green-Refactor. Coverage threshold 90% lines enforced by existing CI (`jest.config.js` `coverageThreshold`). Backend "JUnit Jupiter + AssertJ" clause in the template is N/A — this feature has no backend deliverable; the MDT API is a separate service owned elsewhere.
- [x] **Security (Principle II)**: HMPPS OAuth2/SSO used for the browser session (existing `setUpAuthentication` middleware). All MDT API and reference-data calls use `asSystem()` client-credentials from HMPPS Auth (client id/secret already in `apis.hmppsAuth.systemClient{Id,Secret}` env vars — no new secrets). Roles enforced by new `requirePermissions` middleware (see research §5). Adjudication-service out-link opens in a new tab with `rel="noopener noreferrer"`. No PII in logs — the existing structured logger is used and prisoner numbers are logged only at DEBUG. OWASP checklist reviewed: no user-writable inputs on this page other than sort-header activation (no server round-trip on sort → no injection surface).
- [x] **Accessibility (Principle III)**: Every AC in spec.md includes accessibility-visible outcomes (Tag component for statuses, sortable-table `aria-sort`, tabbed content order, focus management on tab switch). All components are MOJ or GOV.UK. axe-core scan added to the Playwright suite for `/mdt-list` and MUST report zero critical/serious findings; contract in `quickstart.md`.
- [N/A] **Backend stack (Principle IV)**: This feature has no backend deliverable in this repo. The BE endpoints consumed are owned by `hmpps-mandatory-drug-testing-api` (separate service; separate stack governance).
- [x] **Frontend stack (Principle V)**: TypeScript strict + Express + Nunjucks + ESLint confirmed. Build is **esbuild** in this repo (documented pre-existing deviation from the "Webpack" wording in the template; `mdt-tech-stack.md` allows this). No amendment needed.
- [x] **AI usage (Principle VI)**: No prisoner records or secrets included in AI prompts during development. AI-suggested code reviewed for security-sensitive paths (auth token handling, role gating) by a human before merge.
- [N/A] **Microservices (Principle VII)**: The `/health` endpoint and SemVer already exist on this service — no new inter-service contracts introduced here beyond consuming the MDT API's OpenAPI (which the API owner publishes). No AsyncAPI applicable.
- [x] **Observability (Principle VIII)**: Existing Prometheus metrics, Kibana structured-JSON logging, and correlation-ID middleware are reused. New route contributes to standard HTTP counters/histograms with route label `/mdt-list`. Errors from the MDT API and reference-data endpoints are logged with correlation ID; no PII in logs.

No violations → Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-prisoner-testing-lists/
├── spec.md                         # Behaviour spec (authored)
├── plan.md                         # This file
├── research.md                     # Phase 0 output (this command)
├── data-model.md                   # Phase 1 output (this command)
├── quickstart.md                   # Phase 1 output (this command)
├── contracts/                      # Phase 1 output (this command)
│   ├── mdt-list-endpoint.md        #   GET /prisons/{prisonCode}/mandatory-drug-testing-lists/{listDate}
│   ├── tested-reasons-endpoint.md  #   GET /reference-data/tested-reasons
│   └── ui-contract.md              #   Route + view contract exposed by /mdt-list
├── checklists/
│   └── requirements.md             # Existing spec-quality checklist
└── research/
    ├── technical-brief.md          # Existing — authoritative for API, mapping, auth, files
    ├── userResearch.md             # Existing
    └── designs/                    # Existing screenshots
```

### Source Code (repository root)

Only the files listed below are added or edited. Existing structure is preserved.

```text
server/
├── app.ts                                          # EDIT: wire retrieveCaseLoadData + new route
├── config.ts                                       # EDIT: add apis.prisonApi + apis.mandatoryDrugTestingApi; remove apis.exampleApi
├── data/
│   ├── index.ts                                    # EDIT: instantiate MandatoryDrugTestingApiClient; remove ExampleApiClient
│   ├── mandatoryDrugTestingApiClient.ts            # NEW
│   └── mandatoryDrugTestingApiClient.test.ts       # NEW (Jest + nock)
├── services/
│   ├── index.ts                                    # EDIT: register MandatoryDrugTestingService; remove ExampleService
│   ├── mandatoryDrugTestingService.ts              # NEW (shaping, sort, action-rule, reason-lookup cache)
│   ├── mandatoryDrugTestingService.test.ts         # NEW (Jest)
│   └── utils/
│       ├── naturalAlphanumericCompare.ts           # NEW (Location sort)
│       └── naturalAlphanumericCompare.test.ts      # NEW
├── middleware/
│   └── permissions/
│       ├── userPermissionLevel.ts                  # NEW (enum)
│       ├── populateUserPermissions.ts              # NEW
│       ├── populateUserPermissions.test.ts         # NEW
│       ├── requirePermissions.ts                   # NEW (route-guard factory)
│       └── requirePermissions.test.ts              # NEW
├── routes/
│   ├── index.ts                                    # EDIT: mount mdtListRouter; remove example route
│   └── mdtList/
│       ├── mdtListRouter.ts                        # NEW (GET /mdt-list)
│       ├── mdtListController.ts                    # NEW (calls service, renders view)
│       └── mdtListController.test.ts               # NEW
├── views/
│   ├── pages/
│   │   └── mdtList/
│   │       ├── index.njk                           # NEW (page shell + Tabs)
│   │       ├── _mainListTable.njk                  # NEW (Sortable table)
│   │       ├── _reserveListTable.njk               # NEW (Table)
│   │       ├── _summaryBlocks.njk                  # NEW (Completed/Releasing/Weekend)
│   │       └── _detailsBlock.njk                   # NEW ("How are the testing lists ordered?")
│   └── partials/                                   # (unchanged — DPS Header/Footer already wired via connect-dps-components)
├── utils/
│   ├── hasPermissionFilter.ts                      # NEW (Nunjucks filter for template role checks)
│   └── hasPermissionFilter.test.ts                 # NEW
└── interfaces/
    ├── monthlyTestingList.ts                       # NEW (typed API-response shape)
    └── testedReason.ts                             # NEW

integration_tests/                                  # (or `e2e/` — whichever the repo already uses)
├── mdt-list.spec.ts                                # NEW (Playwright: US1–US7 scenarios)
└── mdt-list.a11y.spec.ts                           # NEW (Playwright + axe-core)

# REMOVED (per research/technical-brief.md §9)
server/data/exampleApiClient.ts
server/data/exampleApiClient.test.ts
server/services/exampleService.ts
server/services/exampleService.test.ts
# and: apis.exampleApi from config.ts, Page.EXAMPLE_PAGE from any Page enum,
#      views/pages/index.njk example content (replaced with a redirect to /mdt-list — see R-2)
```

**Structure Decision**: Single-project (Option 1) — this is an SSR web-service with a single `server/` tree. There is no "frontend" workspace to separate; UI concerns live under `server/views/` and per-page controllers under `server/routes/`. This mirrors the existing repo convention exactly.

## Complexity Tracking

No constitution violations. Section intentionally empty.

---

## Phase 0 — Outline & Research

**Output**: [`research.md`](./research.md)

Extracted unknowns (open technical decisions not yet nailed by `research/technical-brief.md`):

- **R-1** Pagination: server-side (query param) vs client-side (JS slicing) at the 50-row boundary (FR-019). Impacts whether sort is server- or client-side.
- **R-2** Fate of `views/pages/index.njk` after `ExampleApi` removal: delete + redirect `/` → `/mdt-list`, or leave a placeholder landing.
- **R-3** Reserve-list stripping when a promoted reserve exists: does the reserve tab still show the row (per FR-006 spec: YES) and is `Order` numbering preserved? — confirm no gaps.
- **R-4** Sort persistence mechanism (FR-028: preserved across tab switches, resets on reload). In-memory state on the client is the obvious choice; verify no server round-trip on tab switch.
- **R-5** "Tested on weekend" summary block source-of-truth (SC-002 requires it to be correct 100%). `lastTestedDate` is a month-precision string in the current sample — is a full date available? — confirm with BE.
- **R-6** Reference-data caching TTL for `GET /reference-data/tested-reasons` (per-request vs process-lifetime).
- **R-7** Error surface for MDT API 404 (no list exists yet for this month, e.g. mid-generation) vs 5xx.

All are addressed in `research.md` with a Decision / Rationale / Alternatives block per item.

## Phase 1 — Design & Contracts

**Prerequisites**: `research.md` complete.

**Outputs**:
- [`data-model.md`](./data-model.md) — `MonthlyTestingList`, `TestingListEntry`, `Prisoner`, `TestedReason`, `MainListViewRow`, `ReserveListViewRow`, `SummaryCounts`, plus derived state (Status, Action, Reserve action rule) and the natural-alphanumeric Location sort spec.
- [`contracts/`](./contracts/) — one document per external contract:
  - `mdt-list-endpoint.md` — request/response schema and error semantics for `GET /prisons/{prisonCode}/mandatory-drug-testing-lists/{listDate}`.
  - `tested-reasons-endpoint.md` — request/response schema for `GET /reference-data/tested-reasons`, incl. cache guidance and 404/5xx fallback (render raw code).
  - `ui-contract.md` — what `/mdt-list` exposes to browsers: route + query params, HTML landmarks / IDs / `data-` attributes that other automated tests (Playwright) rely on, plus the accessibility contract (WCAG 2.1 AA, keyboard order, `aria-sort`).
- [`quickstart.md`](./quickstart.md) — runnable validation scenarios (env vars, dev-run command, axe-core smoke command, a happy-path Playwright command) that exercise US1–US7 end-to-end.

## Constitution Re-check (post-Phase 1 design)

Re-run after `research.md`, `data-model.md`, `contracts/*`, `quickstart.md` were drafted.

- [x] **TDD** — every test to be written is scoped in `data-model.md` §5 and each `contracts/*` "Verification tests" block. Unit tests: `mandatoryDrugTestingApiClient.test.ts`, `mandatoryDrugTestingService.test.ts`, `naturalAlphanumericCompare.test.ts`, `populateUserPermissions.test.ts`, `requirePermissions.test.ts`, `hasPermissionFilter.test.ts`, `mdtListController.test.ts`. Playwright: `mdt-list.spec.ts` (US1–US7) + `mdt-list.a11y.spec.ts`. No implementation begins before its test.
- [x] **Security** — no new secrets. `asSystem()` used for both MDT API calls (see both endpoint contracts). Adjudication link `rel="noopener noreferrer"` per `contracts/tested-reasons-endpoint.md`. Role gating via `requirePermissions` documented in `contracts/ui-contract.md`.
- [x] **Accessibility** — `quickstart.md` V-9 documents the axe-core smoke run; `contracts/ui-contract.md` documents the keyboard-order and `aria-sort` contracts.
- [x] **Frontend stack** — no new dependencies beyond `hmpps-connect-dps-components` 6.3.3 (already installed), `hmpps-auth-clients` 3.0.0 (already installed), `hmpps-rest-client` 2.2.0 (already installed), MOJ `@ministryofjustice/frontend` (already installed), `govuk-frontend` 6.4.0 (already installed).
- [x] **Observability** — new log lines documented in the endpoint contracts (correlation-id propagation, prisoner numbers only at DEBUG). No PII in INFO/WARN/ERROR.

All gates pass. Ready for `/speckit.tasks`.
