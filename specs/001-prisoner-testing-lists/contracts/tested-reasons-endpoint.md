# Contract — `GET /reference-data/tested-reasons`

**Consumer**: `hmpps-mandatory-drug-testing-ui` (this repo), server-side.
**Producer**: `hmpps-mandatory-drug-testing-api` (separate service). **NOT YET IMPLEMENTED** — the FE is built against this contract as if it exists. See `research/technical-brief.md` §7 and `research.md` R-6.
**Auth**: `asSystem()` as per `mdt-list-endpoint.md`.

## Purpose

Resolve `TestingListEntry.reasonNotTested` (a code string, e.g. `REFUSE`) into human-readable display text.

The out-link to the adjudication service (for the "refusing the test" reason) is FE-owned — this endpoint does NOT return URLs. See §3 of `research/technical-brief.md` for the `MANAGE_ADJUDICATIONS_URL` config block.

## Request

- **Method**: `GET`
- **Path**: `/reference-data/tested-reasons`
- **Path/Query params**: none.
- **Headers**:
  - `Authorization: Bearer {system_token}`
  - `Accept: application/json`
- **Body**: none.

## Responses

### 200 OK

**Content-Type**: `application/json`

**Body**: `TestedReason[]` (see `data-model.md` §2).

Example:

```json
[
  { "code": "REFUSE", "description": "Refused a test" },
  { "code": "DISCH",  "description": "Discharged" }
]
```

**Rules**:
- `code` values are stable identifiers owned by the BE (typically short codes like `REFUSE`, `DISCH`).
- `description` is designed to slot into the sentence "Replaced by reserve due to {description}" with no additional formatting.
- No `url` field is returned. For codes whose action should be rendered as a link, the FE substitutes the URL from local config:
  - **`REFUSE`**: rendered as a link. URL is derived from `config.manageAdjudications.urlTemplate` (env `MANAGE_ADJUDICATIONS_URL`; dev default `https://manage-adjudications-dev.hmpps.service.justice.gov.uk/incident-details/{prisonerNumber}`). The `{prisonerNumber}` placeholder is substituted with the ROW's `prisonerNumber` at render time.
  - Any other code: rendered as plain text.
- The link opens in a new tab with `rel="noopener noreferrer"`.

### 404 Not Found

Endpoint hasn't been deployed yet, or has been retired. **FE fallback (R-6)**: cache a special "unavailable" marker for the TTL, and — for any row whose `reasonNotTested` is non-null during that window — render the raw code as the description (e.g. `"Replaced by reserve due to REFUSE"` verbatim), and (for `REFUSE`) still apply the adjudication link. Log a WARN with correlation id.

### 5xx

Same fallback as 404: cache the failure for the TTL and render raw codes in the interim. Log at WARN (not ERROR — the main page still renders).

## Caching

- **Scope**: per-process, in-memory. Not per-request. Not shared across pods (fine — this is small, cheap reference data).
- **TTL**: 5 minutes. On expiry, next request refetches.
- **On 404/5xx**: cache the failure for the same TTL (avoids hammering a broken endpoint).

## Verification tests (unit)

In `server/data/mandatoryDrugTestingApiClient.test.ts` and `server/services/mandatoryDrugTestingService.test.ts`.

At the client level:

1. Happy path — 200 with a valid `TestedReason[]` (each entry has `code` and `description`) → client resolves with the array.
2. 404 → client resolves with an empty array (or throws a typed `NotFoundError`; final decision per repo convention).
3. 500 → client rejects.

At the service level (cache + rendering):

4. First lookup fetches from BE and populates cache.
5. Second lookup within TTL is served from cache (no BE call — verify with `nock` "no unmatched requests").
6. Lookup after TTL refetches.
7. `lookupReason("UNKNOWN_CODE")` returns `{ code: "UNKNOWN_CODE", description: "UNKNOWN_CODE" }` (raw-code fallback).
8. On 404 / 5xx, subsequent `lookupReason(anyCode)` returns the raw-code fallback for the TTL window, then retries.
9. Adjudication URL substitution: given `reasonNotTested === "REFUSE"` and `prisonerNumber === "A1234BC"`, the resulting action `href` equals `MANAGE_ADJUDICATIONS_URL` with `{prisonerNumber}` replaced by `A1234BC`.
10. Non-`REFUSE` codes never produce an `href` — even if the reference data is unavailable.
