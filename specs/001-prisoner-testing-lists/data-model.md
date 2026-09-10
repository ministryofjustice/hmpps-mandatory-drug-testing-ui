# Phase 1 — Data model

**Feature**: 001-prisoner-testing-lists

Entities are grouped into three tiers:

1. **API entities** — the exact shape received from the MDT API. TypeScript interfaces in `server/interfaces/`.
2. **Reference-data entities** — the shape returned by `GET /reference-data/tested-reasons`.
3. **View entities** — the shape produced by `MandatoryDrugTestingService` and consumed by Nunjucks templates. Fully derived; no persistence.

All fields marked "required" MUST be present in every response instance; "optional" fields MAY be omitted or `null`.

---

## 1. API entities

### `MonthlyTestingList`

The response body of `GET /prisons/{prisonCode}/mandatory-drug-testing-lists/{listDate}` (see `contracts/mdt-list-endpoint.md`).

| Field           | Type                 | Required | Notes                                                                                    |
|-----------------|----------------------|----------|------------------------------------------------------------------------------------------|
| `id`            | `string` (UUID)      | yes      | List identifier.                                                                         |
| `month`         | `string` (`YYYY-MM`) | yes      | The month this list covers. MUST equal the effective `listDate` (see 404 fallback below).|
| `prisonLocation`| `string`             | yes      | Establishment code (e.g. `MDI`). MUST equal the request's `prisonCode`.                  |
| `mainList`      | `TestingListEntry[]` | yes, non-empty | Main-list entries. Order preserved from BE (random selection order).               |
| `reserveList`   | `TestingListEntry[]` | yes, non-empty | Reserve-list entries. Order preserved from BE (Order column).                      |

**Validation rules**:
- When the endpoint returns 200 the BE GUARANTEES both `mainList` and `reserveList` are non-empty. If either is empty in a 200 response, log ERROR (BE contract breach) and render the standard error page.
- If no list exists for `{prisonCode, listDate}` the BE returns 404 — see `contracts/mdt-list-endpoint.md` and the 404 fallback flow in research §R-7.
- Every `mainList` entry has `listType = "M"`. Every `reserveList` entry has `listType = "R"`. `listType` is fully determined by which array the entry lives in — the BE never places a reserve entry in `mainList`. A reserve that has been called up is signalled by `promoted = true` on the reserve entry; the FE surfaces that promoted reserve as an additional row on the Main-list view (see §3 `MdtListView`).

### `TestingListEntry`

An entry in either `mainList` or `reserveList`.

| Field                 | Type                                | Required | Notes                                                                                                                 |
|-----------------------|-------------------------------------|----------|-----------------------------------------------------------------------------------------------------------------------|
| `id`                  | `string` (UUID)                     | yes      | Entry identifier. Entries in `mainList` and `reserveList` NEVER share ids — the two arrays are disjoint. |
| `listId`              | `string` (UUID)                     | yes      | Parent list id — equal to `MonthlyTestingList.id`. Not surfaced on the page; useful for downstream navigation.        |
| `prisonerNumber`      | `string`                            | yes      | e.g. `A0036EC`. Hoisted to the entry level (was under `prisoner` in earlier drafts). Displayed under the name.        |
| `listType`            | `"M" \| "R"`                        | yes      | Which array this entry lives in. Always `"M"` for `mainList` entries; always `"R"` for `reserveList` entries. |
| `testedStatus`        | `boolean \| null`                   | yes      | `null` = Not started, `true` = Sample taken, `false` = Unable to test.                                                |
| `reasonNotTested`     | `string \| null`                    | yes      | Reason code when `testedStatus === false`; else `null`. Resolved via reference-data endpoint.                         |
| `listSelectionNumber` | `integer` (≥ 1)                     | yes      | For reserve entries, drives the Order column and the "earliest-promoted" comparison in FR-011.                        |
| `sampleTakenDate`     | `string` (`YYYY-MM-DD`) \| `null`   | yes      | Full date the sample was taken. Non-null only when `testedStatus === true`. Drives the "Tested on weekend" summary.   |
| `lastTestedDate`      | `string` (`YYYY-MM-DD`) \| `null`   | yes      | Most recent recorded test date at any establishment (across the officer's history — not this month). Drives the "Last selected month" column. |
| `prisoner`            | `Prisoner`                          | yes      | See below.                                                                                                            |
| `promoted`            | `boolean \| null`                   | yes      | On `mainList` entries: ALWAYS `null`. On `reserveList` entries: `false` = "Available as reserve", `true` = "Moved to main list". |
| `notes`               | `string \| null`                    | optional | Free-text notes; not surfaced on this page.                                                                           |

**State transitions** (Reserve list, per FR-016 — one-way for this feature):

```
Available as reserve  ──(main-list prisoner marked Unable to test)──▶  Moved to main list
   (promoted: false)                                                     (promoted: true)
```

No transitions in the reverse direction are in scope.

### `Prisoner`

Nested object on every `TestingListEntry`. Note: `prisonerNumber` is NOT on this object — it is on the parent `TestingListEntry`.

| Field         | Type                              | Required | Notes                                                          |
|---------------|-----------------------------------|----------|----------------------------------------------------------------|
| `firstName`   | `string`                          | yes      |                                                                |
| `lastName`    | `string`                          | yes      |                                                                |
| `location`    | `string`                          | yes      | Displayed verbatim (`"A-03-091"`, `"RECP"`, …). See sort rule. |
| `releaseDate` | `string` (`YYYY-MM-DD`) \| `null` | yes      | `null` → view renders "No data available".                     |

### `SummaryCounts` (view-only — derived FE-side)

Not returned by the API. Computed by `MandatoryDrugTestingService` from `mainList`:

| Field                | Type      | Source                                                                                    |
|----------------------|-----------|-------------------------------------------------------------------------------------------|
| `completed`          | `integer` | Rows where `testedStatus !== null`.                                                       |
| `releasingThisMonth` | `integer` | Rows whose `prisoner.releaseDate` falls in the same `YYYY-MM` as `MonthlyTestingList.month`. |
| `testedOnWeekend`    | `integer` | Rows where `sampleTakenDate` falls on Saturday or Sunday (any date, not restricted to the current month — the sample was taken for this month's list). |

---

## 2. Reference-data entities

### `TestedReason`

Element of the response body of `GET /reference-data/tested-reasons` (see `contracts/tested-reasons-endpoint.md`).

| Field         | Type      | Required | Notes                                                                                          |
|---------------|-----------|----------|------------------------------------------------------------------------------------------------|
| `code`        | `string`  | yes      | Matches `TestingListEntry.reasonNotTested`. E.g. `REFUSE`, `DISCH`.                            |
| `description` | `string`  | yes      | Rendered inside the "Replaced by reserve due to [description]" action.                         |

**Validation rules**:
- `code` values are stable identifiers owned by the BE (typically UPPER_SNAKE or short codes like `REFUSE`, `DISCH`).
- Response is a JSON array; a `code`'s presence in the API's `reasonNotTested` field but absence from this reference set MUST NOT crash the render — the raw code is shown as fallback (see R-6).
- No `url` field. The out-link to the adjudication service (for the "refusing the test" reason) is FE-owned: the URL template comes from `config.manageAdjudications.urlTemplate` (env `MANAGE_ADJUDICATIONS_URL`; dev default `https://manage-adjudications-dev.hmpps.service.justice.gov.uk/incident-details/{prisonerNumber}`). The reason code that triggers rendering the action as a link is `REFUSE`.

---

## 3. View entities (derived — produced by `MandatoryDrugTestingService`)

### `MdtListView` (top-level view model)

Passed to `views/pages/mdtList/index.njk`.

| Field                | Type                            | Notes                                                                          |
|----------------------|---------------------------------|--------------------------------------------------------------------------------|
| `caption`            | `string`                        | e.g. `"HMP Moorland"` (FR-023).                                                |
| `heading`            | `string`                        | e.g. `"September 2026"` — matches `MonthlyTestingList.month`. When the current-month call returns 404 and the previous-month fallback succeeds, this reflects the fallback month (see R-7). |
| `fallbackNotice`     | `string \| null`                | Non-null when the previous-month fallback was used — e.g. `"No list exists for {current month} yet — showing {fallback month}."` — rendered as a GOV.UK notification banner above the tabs. |
| `mainRows`           | `MainListViewRow[]`             | Shaped Main-list rows. Built FE-side by concatenating every entry from `MonthlyTestingList.mainList` with every entry from `MonthlyTestingList.reserveList` where `promoted === true`. Default-ordered as in §4. Client sort + paginate on top. |
| `reserveRows`        | `ReserveListViewRow[]`          | Full reserve list, in `listSelectionNumber` ascending.                         |
| `summary`            | `SummaryCounts`                 | See §1.                                                                        |
| `detailsMeta`        | `DetailsMeta`                   | Rows for the "How are the testing lists ordered?" table (FR-024).              |
| `permissions`        | `{ canRecordTest: boolean }`    | Derived from `res.locals.permissions` (see permissions middleware).            |
| `emptyState`         | `boolean`                       | `true` when BOTH the current-month AND the previous-month calls returned 404. When true, `mainRows`/`reserveRows`/`summary` are omitted and the template renders the "No lists currently exist for this prison, please contact your MDT Coordinator to generate a new list" message (per FR-007 / R-7). |

### `MainListViewRow`

Renders one row of the Main list table.

| Field              | Type                                                                                                | Notes                                                                                     |
|--------------------|-----------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| `entryId`          | `string`                                                                                            | Copy of `TestingListEntry.id`. Not shown; used as `data-entry-id` for tests.              |
| `prisonerNumber`   | `string`                                                                                            | For display (under name).                                                                 |
| `prisonerName`     | `string`                                                                                            | Formatted `"{lastName}, {firstName}"`.                                                    |
| `originalList`     | `"Main" \| "Reserve"`                                                                               | `"Main"` when the source entry came from `MonthlyTestingList.mainList` (`listType === "M"`); `"Reserve"` when the source is a `reserveList` entry with `promoted === true` (`listType === "R"`). |
| `location`         | `string`                                                                                            | Verbatim `prisoner.location`.                                                             |
| `locationSortKey`  | `Array<string \| number>`                                                                           | Precomputed natural-alphanumeric key (see §4). Used by the client sort JS.                |
| `releaseDate`      | `string`                                                                                            | Formatted `"DD Mon YYYY"` or `"No data available"`.                                       |
| `releaseSortKey`   | `number`                                                                                            | Epoch ms; `Number.POSITIVE_INFINITY` for `null` (so unknowns sort to the end both ways).  |
| `lastSelectedMonth`| `string`                                                                                            | Formatted `"Month YYYY"` or `"Not tested before"`.                                        |
| `lastSelectedSortKey` | `{ group: 0 \| 1 \| 2; recencyMs: number }`                                                      | Group 0 = "Not tested before", 1 = Sample taken, 2 = Unable to test. See §4.              |
| `status`           | `"Not started" \| "Sample taken" \| "Unable to test"`                                               | Tag component.                                                                            |
| `statusSortKey`    | `0 \| 1 \| 2`                                                                                       | Same order as status list above.                                                          |
| `action`           | `{ kind: "record-test"; href: string } \| { kind: "no-action" } \| { kind: "replaced-by-reserve"; text: string; href?: string } \| { kind: "wait-for-previous-reserve" }` | See §4. |
| `listSelectionNumber` | `integer`                                                                                        | Kept on the row so the client-side "earliest promoted still-untested" computation is trivial. |

### `ReserveListViewRow`

Renders one row of the Reserve list table.

| Field                 | Type                                          | Notes                                            |
|-----------------------|-----------------------------------------------|--------------------------------------------------|
| `entryId`             | `string`                                      | For test hooks.                                  |
| `order`               | `integer`                                     | `listSelectionNumber`.                           |
| `prisonerNumber`      | `string`                                      |                                                  |
| `prisonerName`        | `string`                                      | `"{lastName}, {firstName}"`.                     |
| `location`            | `string`                                      | Verbatim.                                        |
| `lastSelectedMonth`   | `string`                                      | Formatted or `"Not tested before"`.              |
| `status`              | `"Available as reserve" \| "Moved to main list"` | Tag component.                                |

### `DetailsMeta`

Rows for the Details table (FR-024). All strings pre-formatted for display.

| Field                        | Type     | Notes                                            |
|------------------------------|----------|--------------------------------------------------|
| `generatedAt`                | `string` | `"DD Mon YYYY,"` (trailing comma per ticket).    |
| `generatedBy`                | `string` | `"{LastName}, {Initial}."`.                      |
| `avgPopulation`              | `string` | Number, formatted with thousands separator.      |
| `percentageRequested`        | `string` | `"{percentage} ({n} prisoners)"`.                |
| `reserveSize`                | `string` | `"{percentage} {n} prisoners"`.                  |
| `selectionReference`         | `string` | Random-seed value verbatim.                      |

---

## 4. Derived state & rules

### Status Tag mapping (FR-017)

| `testedStatus` | Rendered Tag       |
|----------------|--------------------|
| `null`         | `Not started`      |
| `true`         | `Sample taken`     |
| `false`        | `Unable to test`   |

### Reserve tab Status Tag mapping

| `promoted` (reserve entry)  | Rendered Tag           |
|-----------------------------|------------------------|
| `false` or absent           | `Available as reserve` |
| `true`                      | `Moved to main list`   |

### Action rule (FR-011 / FR-018) — Main list only

Executed row-by-row after all rows are shaped:

```
if testedStatus === true:
    action = { kind: "no-action" }              # "No action needed"
elif testedStatus === false:
    reason  = lookupReason(reasonNotTested)     # via reference-data (see contracts/tested-reasons-endpoint.md)
    text    = `Replaced by reserve due to ${reason.description}`
    if reasonNotTested === "REFUSE":
        # FE-owned adjudication out-link. Substitute {prisonerNumber} from the ROW, not the reason.
        href = config.manageAdjudications.urlTemplate
                    .replace("{prisonerNumber}", row.prisonerNumber)
        action = { kind: "replaced-by-reserve", text, href }
    else:
        action = { kind: "replaced-by-reserve", text }  # no href — plain text
elif testedStatus === null:
    if row.originalList === "Main":                  # source entry from MonthlyTestingList.mainList (listType === "M")
        action = { kind: "record-test", href: recordTestUrl(entryId) }  # subject to role gate
    else:  # row.originalList === "Reserve" — source entry from reserveList with promoted === true
        earliest = min(r.listSelectionNumber for r in mainRows
                       if r.originalList === "Reserve" and r.testedStatus is null)
        if row.listSelectionNumber === earliest:
            action = { kind: "record-test", href: recordTestUrl(entryId) }  # subject to role gate
        else:
            action = { kind: "wait-for-previous-reserve" }                  # text: "Test previous reserve first"
                                                                             # DOES NOT respect role gate — even RW/RWU users see this text.
```

Note: `listType` on the source entry is redundant with `originalList` on the view row (they map 1:1). The FE derives `originalList` from which API array the entry was pulled from, not by inspecting `listType` after the fact — but the two are always consistent.

Role gate is applied in the Nunjucks template using the `hasPermissionFilter` (see FR-029): if the row's action kind is `"record-test"` AND the viewer's permission is `VIEW_ONLY`, the template swaps the link for the text `"No action needed"`.

### Natural-alphanumeric Location sort (spec: US2 AC #5, technical-brief §2)

`locationSortKey` is precomputed on the server as the row is shaped, so the client sort is a simple lexicographic comparison of arrays:

```
"A-03-091"   → ["A-", 3, "-", 91]
"A-03-9"     → ["A-", 3, "-", 9]
"1-3-037"    → ["", 1, "-", 3, "-", 37]
"RECP"       → ["RECP"]
```

Non-digit runs are compared with `localeCompare` (case-insensitive, en-GB); digit runs are compared numerically; shorter arrays sort before longer arrays after a tie. This makes `"A-03-9"` sort before `"A-03-091"`, `"RECP"` sort after any wing-code-with-digit, and any two equally-shaped locations sort predictably.

### Compound Last-selected-month sort (spec: US2 AC #7)

`lastSelectedSortKey` provides:
- `group`: 0 for "Not tested before" (`lastTestedDate === null`), 1 for "Sample taken", 2 for "Unable to test".
- `recencyMs`: epoch ms of `lastTestedDate`, or `0` when null.

Ascending: sort by `group` ASC, then `recencyMs` ASC (least recently recorded first).
Descending: reverse both — sort by `group` DESC, then `recencyMs` DESC (most recently recorded first).

### Release date sort (spec: US2 AC #6)

`releaseSortKey` is epoch ms; `null` → `Number.POSITIVE_INFINITY`. Ascending naturally puts nulls at the end; descending puts them at the end too (client-side rule — see plan.md R-1 / research.md).

### Original list sort (US2 AC #4)

Uses the view row's `originalList`: `"Main"` sorts before `"Reserve"` ascending; reversed descending.

### Prisoner sort (US2 AC #3)

`prisonerName` (i.e. `"{lastName}, {firstName}"`) compared with `localeCompare(undefined, { sensitivity: 'base' })`.

### Status sort (US2 AC #8)

`statusSortKey`: 0 = Not started, 1 = Sample taken, 2 = Unable to test. Same order ascending; reversed descending.

### Summary counts (FR-024 → shaped into `SummaryCounts`)

Summary counts are computed over the Main-list VIEW (i.e. `mainRows`, which is `mainList` + promoted `reserveList` entries — see §3), so a promoted reserve that has been tested contributes to Completed / Tested on weekend.

- **Completed** = count of `mainRows` where `testedStatus !== null`.
- **Releasing this month** = count of `mainRows` where `prisoner.releaseDate` is non-null AND falls in the same `YYYY-MM` as `MonthlyTestingList.month`.
- **Tested on weekend** = count of `mainRows` where `sampleTakenDate` is non-null AND falls on a Saturday or Sunday. The full date is available on every entry (per §1), so no BE aggregate is needed. See R-5 (resolved 2026-09-10).

---

## 5. Test-list (Phase 1 additions to research/technical-brief §6)

New tests introduced by this data model:

- `naturalAlphanumericCompare.test.ts` — covers the location sort spec (§4), including edge cases: `"A-03-091"` vs `"A-03-9"`, `"RECP"` vs `"A-01-001"`, empty string, single token, mixed case.
- `mandatoryDrugTestingService.test.ts` — additional cases beyond the technical-brief listing:
  - `MdtListView.emptyState = true` when BOTH the current-month AND the previous-month calls return 404.
  - `MdtListView.fallbackNotice` populated when the current-month call returns 404 but the previous-month call succeeds; heading + summary + tables reflect the fallback month.
  - Summary counts: `Completed`, `Releasing this month` (edge: prisoner released on the 1st or last day of the month), `Tested on weekend` (derived from `sampleTakenDate` — Saturday, Sunday, Friday-not-counted, and null-safe).
  - Compound `lastSelectedSortKey` ordering across all three groups.
  - Action-rule cases: originally-selected Main "Not started" → Record test; promoted Reserve that is the earliest untested → Record test; promoted Reserve that is NOT earliest → Test previous reserve first (regardless of role); `testedStatus = true` → No action; `testedStatus = false` with `REFUSE` reason → link to `MANAGE_ADJUDICATIONS_URL` with the row's `prisonerNumber` substituted; `testedStatus = false` with `DISCH` (or any non-`REFUSE`) reason → plain text with no link; `testedStatus = false` with unknown reason code → raw code passed through as the description (per R-6).
  - Reference-data cache: hit, miss, TTL expiry, 404, 5xx.
