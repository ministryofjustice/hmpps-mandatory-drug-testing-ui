# Contract — `GET /prisons/{prisonCode}/mandatory-drug-testing-lists/{listDate}`

**Consumer**: `hmpps-mandatory-drug-testing-ui` (this repo), server-side.
**Producer**: `hmpps-mandatory-drug-testing-api` (separate service).
**Auth**: HMPPS Auth client-credentials — token obtained via `asSystem()` from `@ministryofjustice/hmpps-rest-client`. Passed as `Authorization: Bearer {token}` on every request.

## Request

- **Method**: `GET`
- **Path**: `/prisons/{prisonCode}/mandatory-drug-testing-lists/{listDate}`
- **Path params**:
  - `prisonCode` — 3-char establishment code, sourced from `res.locals.user.activeCaseLoadId` (populated by the `retrieveCaseLoadData` middleware; see `plan.md` and `research/technical-brief.md` §3). MUST be URL-encoded.
  - `listDate` — `YYYY-MM` (e.g. `2026-09`). Sourced from the current month/year at request time (server clock, UTC). MUST be URL-encoded.
- **Query params**: none.
- **Headers**:
  - `Authorization: Bearer {system_token}`
  - `Accept: application/json`
- **Body**: none.

Example:
```
GET /prisons/MDI/mandatory-drug-testing-lists/2026-09
```

## Responses

### 200 OK — list exists for the requested prison + month

**Content-Type**: `application/json`

**Body**: `MonthlyTestingList` (see `data-model.md` §1). Example (abbreviated):

```json
{
  "id": "ed3af076-2e01-427d-a24c-ed48ad640ea7",
  "month": "2026-09",
  "prisonLocation": "MDI",
  "mainList": [
    {
      "id": "53225683-0998-4c3d-80b3-babf63324ee3",
      "listId": "ed3af076-2e01-427d-a24c-ed48ad640ea7",
      "prisonerNumber": "A0036EC",
      "listType": "M",
      "testedStatus": null,
      "reasonNotTested": null,
      "listSelectionNumber": 1,
      "sampleTakenDate": null,
      "lastTestedDate": null,
      "prisoner": {
        "firstName": "DAN",
        "lastName": "WEHNER",
        "location": "RECP",
        "releaseDate": null
      },
      "promoted": null,
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
      "listSelectionNumber": 1,
      "sampleTakenDate": null,
      "lastTestedDate": null,
      "prisoner": {
        "firstName": "JOHN",
        "lastName": "SMITH",
        "location": "1-3-037",
        "releaseDate": null
      },
      "promoted": false,
      "notes": null
    }
  ]
}
```

**FE contract on 200**:
- `month` in response MUST equal the `listDate` in the request. If not, log ERROR and render the standard error page (data integrity issue).
- `prisonLocation` in response MUST equal the `prisonCode` in the request.
- `mainList` and `reserveList` MUST both be non-empty. If either is empty, log ERROR and render the standard error page — this is a BE contract breach (a generated list always has both).
- **`listType` is fully determined by which array an entry appears in**: every `mainList` entry has `listType === "M"` and every `reserveList` entry has `listType === "R"`. The BE never places a reserve-list entry inside `mainList`. If a mismatch is seen, log WARN and treat the containing array as the source of truth.
- `promoted` semantics: on `mainList` entries it is ALWAYS `null` and is ignored by the FE. On `reserveList` entries it is a boolean — `true` means the reserve has been called up to the Main list; `false` means it is still "Available as reserve".
- **Promoted reserves are surfaced to the Main list view FE-side**: the FE concatenates `mainList[]` with `reserveList.filter(r => r.promoted === true)` to build the Main-list view rows. The Reserve tab renders the ENTIRE `reserveList` unchanged. The same reserve entry therefore appears in both tabs when `promoted === true` — with no duplication in the API response.

### 404 Not Found — no list exists for this prison + month

Body may be empty or a problem+json envelope. FE ignores the body.

**FE contract on 404** (updated 2026-09-10; see `research.md` R-7):

1. Compute the previous month (`YYYY-MM` minus one; e.g. current `2026-09` → previous `2026-08`; January rolls over to previous year's December).
2. Re-issue the same call with the previous month's `listDate`.
3. If that call returns 200, render the page with the returned list; set `MdtListView.fallbackNotice` to a message noting that the current month has no list yet and the previous month is being shown. The `<h1>` reflects the fallback month, not the requested month.
4. If the previous-month call ALSO returns 404, render the empty-state view (`MdtListView.emptyState = true`) with the message: **"No lists currently exist for this prison, please contact your MDT Coordinator to generate a new list"** (per FR-007).
5. HTTP status returned to the browser is 200 in both fallback branches (this is an expected state, not an error).

The fallback retry MUST NOT be recursive — only ONE previous-month retry is attempted. Do not iterate further back through history.

### 401 / 403 — token rejected

Should never happen in production if client-credentials are configured correctly. FE treats as 5xx (see below).

### 5xx — BE unavailable

FE catches, logs at ERROR with correlation id, renders the standard DPS error page.

## Timeouts

- Response deadline: `MANDATORY_DRUG_TESTING_API_TIMEOUT_RESPONSE` (default 10000 ms).
- Overall deadline: `MANDATORY_DRUG_TESTING_API_TIMEOUT_DEADLINE` (default 10000 ms).

Configured in `apis.mandatoryDrugTestingApi` in `server/config.ts`.

## Correlation

- Outgoing header: `x-correlation-id: {correlationId}` (the existing repo-wide correlation-id propagation middleware handles this).

## Verification tests (unit)

Located in `server/data/mandatoryDrugTestingApiClient.test.ts` and `server/services/mandatoryDrugTestingService.test.ts`. Use `nock` to intercept:

At the client:

1. Happy path — 200 with a valid `MonthlyTestingList` → client resolves with the shaped response.
2. 404 → client resolves with `null` (per repo convention for absent resources).
3. 500 → client rejects; error surfaces to controller.
4. Timeout → client rejects with `TimeoutError`; error surfaces.
5. `Authorization` header present and includes a Bearer token.
6. URL-encoding of `prisonCode` and `listDate` handles unexpected characters safely (defence-in-depth).

At the service (404-fallback flow):

7. Current-month 200 → return that list; `fallbackNotice = null`, `emptyState = false`.
8. Current-month 404, previous-month 200 → return the previous-month list; `fallbackNotice` populated with the current + fallback months; `emptyState = false`.
9. Current-month 404, previous-month 404 → `emptyState = true`; no list data; message = "No lists currently exist for this prison, please contact your MDT Coordinator to generate a new list".
10. Current-month 5xx → rejects (no fallback attempted — only 404 triggers fallback).
11. Previous-month 5xx after current-month 404 → rejects (the fallback attempt's own 5xx surfaces).
12. Month arithmetic: December 2026 → previous month = November 2026; January 2027 → previous month = December 2026.
