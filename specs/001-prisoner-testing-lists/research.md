# Phase 0 — Research

**Feature**: 001-prisoner-testing-lists
**Companion**: `research/technical-brief.md` (authoritative for the already-decided items — API, auth, roles, file plan, ExampleApi removal, terminology, promoted-reserve action rule). This file only resolves the residual `NEEDS CLARIFICATION` items enumerated in `plan.md` under Phase 0.

---

## R-1 — Pagination boundary (server- vs client-side)

**Decision**: **Client-side pagination.** The service fetches the entire monthly list in a single MDT API call and paginates the rows in the browser at the 50-row boundary (FR-019), using the MOJ Pagination component. Sort is also client-side (already implicit in FR-028's "resets on reload" wording).

**Rationale**:
1. Scale (Scale/Scope in plan.md) is 20–150 rows on the main list per month per establishment — well within a single response payload; no reason to split into pages server-side.
2. Sort semantics are complex (natural-alphanumeric Location, compound Last-selected-month rule) and are already fully expressible in the browser; keeping sort local avoids two divergent implementations (server + client).
3. FR-028 ("sort preserved across tab switches, resets on reload") is trivially satisfied by keeping state in module-scope JS on the client; a server-side sort would require query-string round-trips that would fire the auth flow and API call on every sort click.
4. The MOJ Sortable Table pattern is designed for client-side sort; using it server-side would either duplicate the sort logic or block on server round-trips (visible latency).
5. Progressive enhancement is preserved: the default (no-JS) render shows the API's returned order — the same order FR-005 defines as the default — and includes the full 50-row first page as a static server-rendered HTML table.

**Alternatives considered**:
- **Server-side pagination + sort via query string**: adds a round-trip per sort click, forces the sort logic into the service layer where it can't be shared with the no-JS baseline (which still needs a "default" ordering — that's fine, but any interactive sort then needs a page reload). Rejected: no scale justification, worse UX.
- **Server-side sort but client-side pagination**: worst of both worlds — you need to duplicate the sort in JS anyway to keep FR-028's "no reload on tab switch" behaviour cheap.

**Impact on plan**: `mandatoryDrugTestingService` shapes and returns the full list; the Nunjucks template renders all rows into the DOM (progressive enhancement); a small JS module attaches sortable-table behaviour + client-side pagination. The 50-row first-page slice is applied in the template so that the no-JS view respects the pagination limit too.

---

## R-2 — Fate of `views/pages/index.njk` after ExampleApi removal

**Decision**: **Delete the example content of `views/pages/index.njk` and replace the `/` route with a 302 redirect to `/mdt-list`.** No landing page is added.

**Rationale**:
1. This service exists to deliver Mandatory Drug Testing functionality; `/mdt-list` is the only user-facing page in this feature and, per the design ticket, is the intended primary destination.
2. A DPS Header/Footer chrome landing with no content adds no value and risks user confusion ("did the page fail to load?").
3. Role gating on `/mdt-list` (FR-029) means unauthorised users get a proper 403 there — the redirect target's own auth handles it correctly; no double gate needed.
4. This mirrors the pattern used by peer M&I services (see reference repo `hmpps-transfer-scheduler-ui` — `/` redirects into its main page).

**Alternatives considered**:
- **Keep `views/pages/index.njk` as a lightweight landing linking to `/mdt-list`**: adds a page to maintain (translations, accessibility scan, tests) for a page users are unlikely to see. Rejected: not worth the cost.
- **Return 404 on `/`**: hostile UX; users typing the bare hostname get an error.

**Impact on plan**: `server/routes/index.ts` changes:
- Remove the mount of the example route.
- Add `router.get('/', (_req, res) => res.redirect(302, '/mdt-list'))`.
- Remove `views/pages/index.njk` entirely and any `Page.EXAMPLE_PAGE` enum entry.

---

## R-3 — Reserve list rendering when reserves are promoted

**Decision**: **The Reserve list tab ALWAYS displays every entry the API returned in `reserveList`, in `listSelectionNumber` ascending order, with no gap in the `Order` column.** Promotion state is expressed only by the Status Tag ("Moved to main list" vs "Available as reserve"); the row itself never leaves the reserve tab.

**Rationale**:
1. FR-006 already states "Every reserve returned by the API MUST be shown on this tab, whether or not they have been moved to the main list."
2. The `Order` column shows `listSelectionNumber` verbatim; because the BE preserves this number regardless of `promoted`, the visible order is 1, 2, 3, … with no gaps.
3. Officers use the reserve tab to see who is available and who has been used — hiding used reserves would defeat the purpose.

**Alternatives considered**: none warranted — the spec already fixes this.

**Impact on plan**: `_reserveListTable.njk` renders unconditionally over `reserveList`. `MandatoryDrugTestingService` does not filter reserve entries; it maps `promoted` → Status Tag.

---

## R-4 — Sort persistence across tab switches (FR-028)

**Decision**: **Sort state lives in a module-scoped JS object in the browser page, keyed by column id + direction. Tab switching is a pure CSS/JS class toggle on the two `<section>`s (no page reload, no server round-trip); the sort state survives naturally. A hard reload or a fresh navigation to `/mdt-list` re-executes the module and resets state to defaults.**

**Rationale**:
1. FR-028 wants "preserved across tab switches, resets on reload" — module state satisfies both exactly.
2. GOV.UK Tabs already implements the tab-switch as an in-page action (no navigation), so switching tabs does not tear down the JS module.
3. Using `sessionStorage` would give the wrong semantics (survives reloads). Query string would give the wrong semantics (survives copy-paste of URL — unwanted here).

**Alternatives considered**:
- **`sessionStorage`**: rejected — survives reload, breaks FR-028.
- **URL query param (`?sort=…&dir=…`)**: rejected — copy-paste of URL would re-apply the sort, which is inconsistent with FR-028 ("resets on reload").
- **Server-side sort echoed back**: rejected under R-1.

**Impact on plan**: A single small JS module in `assets/js/mdtList.ts` (or the repo's equivalent asset entry point) wires the MOJ sortable-table behaviour to the shaped-row dataset embedded in a `<script type="application/json" id="mdt-list-data">…</script>` block by the Nunjucks template. Same module handles pagination.

---

## R-5 — "Tested on weekend" summary block source-of-truth (SC-002)

**Decision (resolved 2026-09-10 by the new API schema)**: **Derive the count FE-side from `sampleTakenDate` on each `mainList` entry.** No BE aggregate needed, no second call needed.

**Rationale**:
1. The new schema exposes `sampleTakenDate` (a full `YYYY-MM-DD` date) on every entry — non-null exactly when `testedStatus === true`.
2. The FE simply counts main-list entries whose `sampleTakenDate` falls on Saturday or Sunday.
3. Single-call render preserved; no envelope-level aggregate needed.

**Alternatives considered**: previously proposed envelope-level `summaryCounts.testedOnWeekend` — no longer needed given `sampleTakenDate` is exposed per row.

**Impact on plan**: `mandatoryDrugTestingService.testedOnWeekendCount(list)` iterates `list.mainList`, returns the count where `new Date(entry.sampleTakenDate).getDay() ∈ {0, 6}`. Test cases cover Saturday, Sunday, Friday (excluded), null (excluded).

---

## R-6 — Reference-data caching TTL for `GET /reference-data/tested-reasons`

**Decision**: **Per-process in-memory cache with a 5-minute TTL. Cache misses on unknown codes fall through to a live call; a 404 or 5xx from the endpoint causes the FE to render the raw reason code as the description (graceful degradation) and log a WARN with the correlation id. The adjudication out-link (for `REFUSE`) is applied even when reference-data lookup fails — because the URL comes from local config, not from the endpoint.**

**Rationale**:
1. Reference data changes very rarely (a code list); a 5-minute TTL is a good balance between staleness and load.
2. Per-process (not per-request) means at most one HTTP call per pod per 5 minutes for this data — negligible.
3. The endpoint is not yet built BE-side; in current data conditions the endpoint will only be called once records with a `reasonNotTested` value exist. When it starts being called, cache hits will dominate immediately.
4. Graceful degradation (render the raw code) means a BE outage on the reference-data endpoint does not break the main page render — the "Unable to test" rows still render, they just show a code instead of a friendly label.
5. Separating the adjudication URL from the reason data (via `MANAGE_ADJUDICATIONS_URL` env var) means the `REFUSE` link works regardless of reference-data availability.

**Alternatives considered**:
- **Per-request cache only**: rejected — insufficient reuse, one call per page load.
- **No cache**: rejected — one call per page load and per unique code lookup, no benefit.
- **Long-lived (24h) cache**: rejected — makes it harder to roll out a reason-text update.

**Impact on plan**: `MandatoryDrugTestingService` owns a small module-scope `Map<string, TestedReason>` + expiry timestamp. Tests must cover: cache hit, cache miss (fetches), TTL expiry (re-fetches), 404 fallback (raw code + WARN log), 5xx fallback (raw code + WARN log), URL substitution for `REFUSE`.

---

## R-7 — Error surface for MDT API 404 vs 5xx

**Decision (updated 2026-09-10)**:

- **404 on the current month** — no list has been generated yet. The FE retries ONCE with the previous month's `YYYY-MM`:
  - If the retry returns 200, render the previous month's list with a notification banner ("No list exists for {current month} yet — showing {previous month}.") and set `<h1>` to the previous month.
  - If the retry also returns 404, render the empty-state page with the message: **"No lists currently exist for this prison, please contact your MDT Coordinator to generate a new list"** (per FR-007).
  - In both branches the HTTP status returned to the browser is 200.
- **5xx / network** (BE unavailable): the existing global error handler renders the standard DPS error page ("Sorry, there is a problem with the service") with a "Try again later" link back to `/mdt-list`. Log at ERROR with correlation id. Only 404 triggers the fallback — 5xx does NOT.
- **401/403** from the MDT API (client-credentials misconfigured): treated as 5xx above — this is a config problem, not a user problem, and shouldn't leak to the browser.

**Rationale**:
1. Officers hitting the page mid-month before this month's list has been generated should see the previous month's list — it's the most relevant data available and matches the "check again shortly" behaviour they'd otherwise adopt.
2. Falling back further than one month risks showing stale data that officers may act on incorrectly — one hop is enough to bridge the generation window at month boundaries.
3. The "please contact your MDT Coordinator" text is prescribed by the spec (FR-007).
4. Distinguishing 404 (recoverable via fallback) from 5xx (genuinely broken) at the client layer keeps the controller simple.

**Alternatives considered**:
- **Same page for 404 and 5xx**: rejected — misleads the officer and dilutes real error signals.
- **No fallback — always show the "no lists" message on 404**: rejected — officers would lose access to last month's list mid-generation.
- **Iterate back through history until a list is found**: rejected — risk of showing stale data; one hop is the correct scope.

**Impact on plan**:
- `MandatoryDrugTestingApiClient.getMonthlyList` returns `Promise<MonthlyTestingList | null>` — `null` on 404, throws on 5xx.
- `MandatoryDrugTestingService.getViewModel(prisonCode, currentMonth)` orchestrates the fallback: call current-month; if `null`, call previous-month; if `null`, set `emptyState = true`. Populate `fallbackNotice` if the previous-month call succeeded.
- Playwright tests cover all three states: current-month 200, current-404-previous-200 (fallback banner + heading reflects previous month), current-404-previous-404 (empty state).

---

## Summary of decisions

| Ref  | Decision                                                                                     |
|------|-----------------------------------------------------------------------------------------------|
| R-1  | Client-side pagination + client-side sort. Entire list fetched in one MDT API call.           |
| R-2  | `/` redirects (302) to `/mdt-list`; delete `views/pages/index.njk`.                           |
| R-3  | Reserve tab always shows all reserves; Order gaps never appear.                               |
| R-4  | Sort state in module-scoped JS; survives tab switch, resets on reload.                        |
| R-5  | `sampleTakenDate` on each entry is the source of truth; FE derives the "Tested on weekend" count. |
| R-6  | Per-process 5-min cache for tested-reasons; raw code as fallback on 404/5xx. Adjudication URL for `REFUSE` comes from `MANAGE_ADJUDICATIONS_URL` env var. |
| R-7  | 404 → retry previous month; if that 200 render with fallback banner; if that 404 render empty state with the exact spec message. 5xx → DPS error page. 401/403 → treated as 5xx. |

All `NEEDS CLARIFICATION` items are resolved. Ready for Phase 1.
