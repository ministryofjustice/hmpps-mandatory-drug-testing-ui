# Quickstart — validating the MDT list page

**Feature**: 001-prisoner-testing-lists

This document lists the runnable scenarios that prove the feature works end-to-end. It intentionally does not include implementation snippets — implementation details live in `data-model.md`, `contracts/`, and (eventually) `tasks.md`.

## Prerequisites

- Node 24, npm 11 (per `package.json` `engines`).
- Access to the HMPPS Auth dev tenant and a set of client credentials scoped for this service.
- Local checkout of this repo.

## One-off setup

```bash
npm ci
npx playwright install --with-deps
cp feature.env.example feature.env   # if the file exists in the repo; otherwise create feature.env manually — see below
```

## Environment variables

Ensure the following are present in `feature.env` for local runs (and set as secrets in each deployed environment). Values shown are dev defaults.

| Variable                                    | Purpose                                                                 | Dev value                                                                 |
|---------------------------------------------|-------------------------------------------------------------------------|---------------------------------------------------------------------------|
| `PRISON_API_URL`                            | `apis.prisonApi.url` — used by `retrieveCaseLoadData`                    | `http://127.0.0.1:8080` (code default); dev env sets `https://prison-api-dev.prison.service.justice.gov.uk` |
| `PRISON_API_TIMEOUT_RESPONSE`               | Response timeout for the prison API                                     | `10000`                                                                   |
| `PRISON_API_TIMEOUT_DEADLINE`               | Overall deadline for the prison API                                     | `10000`                                                                   |
| `MANDATORY_DRUG_TESTING_API_URL`            | `apis.mandatoryDrugTestingApi.url`                                      | `http://127.0.0.1:8080` (code default); dev env sets `https://mandatory-drug-testing-api-dev.hmpps.service.justice.gov.uk` |
| `MANDATORY_DRUG_TESTING_API_TIMEOUT_RESPONSE` | Response timeout                                                       | `10000`                                                                   |
| `MANDATORY_DRUG_TESTING_API_TIMEOUT_DEADLINE` | Overall deadline                                                        | `10000`                                                                   |
| `MANAGE_ADJUDICATIONS_URL`                  | URL template for the `REFUSE` reason action link; MUST contain the `{prisonerNumber}` placeholder | `https://manage-adjudications-dev.hmpps.service.justice.gov.uk/incident-details/{prisonerNumber}` |
| `HMPPS_AUTH_URL`, `HMPPS_AUTH_EXTERNAL_URL` | Existing repo vars for HMPPS Auth                                       | (existing dev values)                                                     |
| `SYSTEM_CLIENT_ID`, `SYSTEM_CLIENT_SECRET`  | Client-credentials pair for `asSystem()` calls                          | (from HMPPS platform team; NEVER commit)                                  |

Notes:
- API `url` code defaults are localhost per constitution-driven local-first convention; deployed environments override via env vars.
- `MANAGE_ADJUDICATIONS_URL` is the only new env var introduced by this feature. Preprod and prod values are supplied via secrets by the platform team.

## Running the service locally

```bash
npm run start:dev
# in another shell:
npm run start-feature:dev
```

Open <http://localhost:3000/mdt-list>. You'll be redirected through HMPPS Auth; sign in as a user with `MANDATORY_DRUG_TESTING_RO`, `MANDATORY_DRUG_TESTING_RW`, or `MANDATORY_DRUG_TESTING_RWU`, and whose active case load has a list generated in the MDT API dev environment for the current month.

## Validation scenarios

Each scenario maps to a user story in `spec.md`.

### V-1 — Page renders with correct chrome, header, and both tabs (US1, US7)

1. Sign in with any of the three roles.
2. Navigate to `/mdt-list`.
3. Confirm:
   - Page title is `MDT list - Mandatory drug testing - DPS`.
   - DPS Header and Footer render correctly (same visual treatment as Official Visits).
   - Breadcrumbs are present.
   - Caption reads `HMP {your active caseload's prison name}`.
   - `<h1>` reads `{Month} {Year}` matching the current month.
   - Main list tab is active by default.
   - Reserve list tab is visible and switchable.

**Automated equivalent**: `integration_tests/mdt-list.spec.ts` → `us1-us7`.

### V-2 — Main list rows and columns (US1)

1. From V-1, ensure the Main list tab is active.
2. Confirm the table shows one row per prisoner returned by the MDT API for the current month.
3. Confirm the columns are: Prisoner (last, first, with prisoner number underneath), Original list, Location, Release date (CRD), Last selected month, Status, Action — in that order.
4. Confirm any prisoner with no CRD shows "No data available" in the Release date column.
5. Confirm the location value is rendered verbatim (e.g. `RECP` or `A-03-091`).

### V-3 — Sortable main list (US2)

1. Activate each sortable column header in turn.
2. Confirm sort semantics per `spec.md` US2 ACs #3–8 (Prisoner alphabetical, Original list M/R, Location natural-alphanumeric, Release date with nulls at the end, Last selected month grouped-then-recency, Status grouped).
3. Confirm every column except Action offers a sort control; Action does not.
4. Confirm rows whose Original list is "Reserve" participate in the sort (no sticky positioning).
5. Switch tabs to Reserve list and back — sort is preserved.
6. Reload the page — sort resets to the default.

### V-4 — Reserve list rendering (US4)

1. Switch to the Reserve list tab.
2. Confirm columns: Order, Prisoner, Location, Last selected month, Status. No Action column, no Original list column.
3. Confirm rows are ordered by `Order` ascending with no gaps.
4. Confirm reserves with `promoted = true` show status Tag "Moved to main list"; the rest show "Available as reserve".
5. Confirm no column shows a sort control.

### V-5 — Reserve promotion flow (US3)

**Requires** a test scenario where the officer can mark a prisoner as "Unable to test". Because the recording journey is out of scope for this feature, this scenario is validated using a BE-seeded state: seed one main-list prisoner with `testedStatus = false`, `reasonNotTested = "REFUSE"`, and one reserve-list entry with `promoted = true`.

1. Load `/mdt-list`.
2. On the Main list, confirm:
   - The seeded original prisoner's Action column shows `"Replaced by reserve due to Refused a test"` as a link. The `href` MUST equal `MANAGE_ADJUDICATIONS_URL` with `{prisonerNumber}` substituted by that row's prisoner number — e.g. `https://manage-adjudications-dev.hmpps.service.justice.gov.uk/incident-details/A0036EC`. The link opens in a new tab (`target="_blank" rel="noopener noreferrer"`).
   - The promoted reserve appears in the Main list with Original list `Reserve` and (because they're the earliest promoted-still-untested reserve) Action `"Record test"` (RW/RWU) or `"No action needed"` (RO).
3. Switch to the Reserve tab and confirm the same prisoner appears with Status Tag `"Moved to main list"`, order preserved.

Then seed a second `Unable to test` (with a non-`REFUSE` reason such as `DISCH`) + a second reserve with `promoted = true`. Reload and confirm:
4. The earlier-promoted reserve still shows `"Record test"`.
5. The later-promoted reserve shows `"Test previous reserve first"` — regardless of role.
6. The `DISCH` original row's Action is `"Replaced by reserve due to Discharged"` as PLAIN TEXT (no link) — the URL rule applies only to `REFUSE`.

### V-6 — Record test entry point respects role (US5)

1. Sign in with `MANDATORY_DRUG_TESTING_RW` or `MANDATORY_DRUG_TESTING_RWU`.
2. Load `/mdt-list`. On a "Not started" originally-selected row, confirm the Action column shows a `"Record test"` link.
3. Activate the link — you are taken to the recording-journey entry point (which is a stub in this feature).
4. Sign out and sign back in as `MANDATORY_DRUG_TESTING_RO`.
5. Reload `/mdt-list`. Confirm every "Not started" row's Action column now shows `"No action needed"` — no clickable link.

### V-7 — Details block (US6)

1. From V-1, click `How are the testing lists ordered?`.
2. Confirm the metadata table shows Generated time and date, Generated by, Population over last 12 months, Percentage requested, Reserve list size, Selection reference — each with plausible values.
3. Confirm the body text is present per FR-024.

### V-8 — 404 previous-month fallback and empty state (research.md R-7)

Two sub-scenarios, both driven by BE mocks (or a test establishment for which the BE returns 404).

**V-8a — Previous-month fallback**

1. Configure the BE such that the current month returns 404 but the previous month returns 200 with a valid list.
2. Load `/mdt-list`.
3. Confirm:
   - HTTP status 200.
   - A GOV.UK notification banner above the tabs states that no list exists yet for the current month and the previous month is being shown.
   - `<h1>` reads the PREVIOUS month, not the current month.
   - Tabs and tables render exactly as they would for the previous month's data.

**V-8b — Both months absent (empty state)**

1. Configure the BE such that BOTH the current month and the previous month return 404.
2. Load `/mdt-list`.
3. Confirm:
   - HTTP status 200.
   - Chrome, breadcrumbs, caption, and `<h1>` render.
   - Tabs and tables are ABSENT.
   - A `govuk-panel` element displays the exact text **"No lists currently exist for this prison, please contact your MDT Coordinator to generate a new list"** — no other wording, no substitutions.

### V-9 — Accessibility (constitution Principle III)

Run the axe-core scan:

```bash
npm run int-test -- integration_tests/mdt-list.a11y.spec.ts
```

Expected: zero critical or serious violations on both the populated and the empty-state variants.

Additionally, exercise keyboard-only navigation from the URL bar through to a Record test link and back, confirming the tab order documented in `contracts/ui-contract.md`.

## Automated commands

Run before every push:

```bash
npm run typecheck
npm run lint
npm test
```

Run before merging or before a release candidate:

```bash
npm run test:ci
npm run int-test
```

CI runs `test:ci`, `int-test`, and the `security_audit`. Coverage MUST be ≥ 90% lines for the feature (per constitution Principle I / `mdt-tech-stack.md`).

## Rollback

- Frontend rollback is a redeploy of the previous image tag; there is no migration or data change in this feature.
- If the MDT API deprecates the reference-data endpoint mid-flight, the FE degrades gracefully to raw reason codes (see `contracts/tested-reasons-endpoint.md`).
