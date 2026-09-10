# Feature Specification: Mandatory Drug Testing — Main & Reserve Prisoner Lists

**Feature Branch**: `001-prisoner-testing-lists`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "Mandatory drug testing page showing a monthly list of prisoners returned from an API in two tabs — a main list and a reserve list — with sortable columns on the main list, per-row test actions, and automatic replacement of not-completed prisoners with the next reserve in order, alongside a header showing the list month and active prison establishment."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View this month's main testing list for the active establishment (Priority: P1)

A drug testing officer signs in and lands on the Mandatory Drug Testing page. The page header confirms the month the list covers and the prison establishment currently in scope, so the officer is certain they are working on the correct cohort before taking any action. The main list tab is open by default and shows every prisoner selected for this month's mandatory testing, together with the information the officer needs to locate and identify each prisoner and understand where each one is in the testing process.

**Why this priority**: This is the primary daily task for the officer. Without a trustworthy, correctly scoped list they cannot perform any testing at all. It is the minimum viable slice that delivers value on its own.

**Independent Test**: Load the page for a signed-in officer at an establishment with a populated monthly list. Verify the header shows the correct month and establishment, that the main list tab is active by default, that all expected prisoners are shown, and that each row displays the prisoner (last name, first name, and prisoner number), original list, location, release date (CRD), last selected month, status, and an action.

**Acceptance Scenarios**:

1. **Given** the officer is signed in at an establishment that has a main list for the current month, **When** they open the Mandatory Drug Testing page, **Then** the page header shows a caption in the format "HMP {Prison Name}" and an H1 in the format "{Month} {Year}", and the Main list tab is shown as selected.
2. **Given** the main list has been returned by the API, **When** the page renders, **Then** each row shows the prisoner's last name and first name with prisoner number displayed underneath, the original list they came from (Main or Reserve), location, release date (CRD), last selected month, status (as a Tag), and an action appropriate to the row's status.
3. **Given** the API returns 404 for both the current month and the previous month for the officer's active establishment, **When** the page renders, **Then** the page shows an empty-state view with the message "No lists currently exist for this prison, please contact your MDT Coordinator to generate a new list".
4. **Given** the main list is displayed, **When** the officer views the page, **Then** an H2 "Main list" precedes the table and three summary blocks are shown above it: **Completed** (count of prisoners on this month's list whose Status is "Sample taken" or "Unable to test"), **Releasing this month** (count of prisoners on this month's list whose release date falls within the calendar month the list covers), and **Tested on weekend** (count of prisoners on this month's list whose test for this month's list was recorded on a Saturday or Sunday).

---

### User Story 2 - Sort the main list to work through prisoners efficiently (Priority: P1)

The officer needs to work through the list in an order that suits the task at hand — for example, sorting by "Location" to walk a wing, or by "Last selected month" to focus on prisoners not tested recently. Every displayed column on the main list except Action can be sorted ascending or descending, and the current sort state is visible so the officer knows how the list is ordered.

**Why this priority**: Officers routinely need to reorder the list to plan their work. Without sorting, the list is difficult to use in a real operational setting even if the data is correct.

**Independent Test**: With a populated main list, activate each sortable column header in turn and verify the rows re-order accordingly per the rules below, and the sort direction indicator updates.

**Acceptance Scenarios**:

1. **Given** the main list first loads, **When** no explicit sort has been applied, **Then** rows appear in the order returned by the API (preserving the randomly generated selection order for originally-selected main entries, followed by any promoted-from-reserve rows in the order of their Reserve list Order column).
2. **Given** the main list is displayed, **When** the officer activates a sortable column header, **Then** the rows are re-ordered by that column ascending and the header indicates the active sort; a second activation flips it to descending.
3. **Given** the officer sorts by **Prisoner**, **Then** rows are ordered alphabetically by surname (ascending A→Z, descending Z→A).
4. **Given** the officer sorts by **Original list**, **Then** ascending orders Main before Reserve, and descending orders Reserve before Main.
5. **Given** the officer sorts by **Location**, **Then** rows are ordered by the prisoner's cell location using natural alphanumeric ordering across the location's components (e.g. locations of the form "A-03-091" sort first by wing letter, then numerically by landing, then numerically by cell), ascending low→high and descending high→low.
6. **Given** the officer sorts by **Release date (CRD)**, **Then** ascending orders soonest release first and descending orders furthest release first; rows with no CRD are grouped together at the end of the sort in both directions.
7. **Given** the officer sorts by **Last selected month**, **Then** ascending groups rows by tested status in the order "Not tested before" → "Sample taken" → "Unable to test", and within each group orders least-recently-recorded first; descending groups in the order "Unable to test" → "Sample taken" → "Not tested before", and within each group orders most-recently-recorded first.
8. **Given** the officer sorts by **Status**, **Then** rows are grouped by the Tag value ("Not started", "Sample taken", "Unable to test") in a consistent order ascending and reversed descending.
9. **Given** the Action column is displayed, **When** the officer inspects its header, **Then** no sort control is offered on Action.
10. **Given** the main list is sorted by any column, **When** the officer switches to the reserve list tab and back within the same page instance, **Then** the previously applied sort is preserved on the main list; **When** the officer reloads the page or navigates away and back, **Then** the sort resets to the default order.
11. **Given** any sort is applied, **When** the rows render, **Then** all rows on the Main list — including those whose Original list is "Reserve" — participate in the sort on equal terms; there is no sticky positioning of any row.

---

### User Story 3 - See the reserve list in fixed priority order (Priority: P1)

The officer switches to the Reserve list tab to see prisoners held back as replacements. The tab is introduced with an explanation that reserves are used when a main-list prisoner cannot be tested and, if moved to the main list, must be tested in list order. Every reserve prisoner returned by the API is shown here — including any who have already been promoted to the main list, whose status makes clear that they have been moved. The order is visible on every row, and the columns cannot be reordered so the priority sequence is never obscured.

**Why this priority**: The whole point of the reserve list is a deterministic call-up order and a complete record of every reserve. If it could be sorted, or if promoted reserves disappeared from view, officers could lose sight of who is next or of what has already happened. Presenting it correctly is essential to the replacement workflow (User Story 4).

**Independent Test**: Open the Reserve list tab. Verify the H2 "Reserve list" and the introductory explanation are shown; verify columns render Order, Prisoner (last name, first name, and prisoner number underneath), Location, Last selected month, and Status; verify no column can be sorted; verify the rows are ordered by the order column ascending and that all reserves — including ones already moved to the main list — are shown.

**Acceptance Scenarios**:

1. **Given** the Reserve list tab is open, **When** the page renders, **Then** an H2 "Reserve list" and an introductory paragraph — "Reserves are used when a main-list prisoner cannot be tested. They need to be tested in list order if used." — are shown, and each row shows Order, the prisoner's last name and first name with prisoner number underneath, location, last selected month, and status (as a Tag); no action or "original list" column is shown.
2. **Given** the Reserve list is displayed, **When** the officer inspects any column header, **Then** no sort control is offered on any column.
3. **Given** the Reserve list is displayed, **When** the rows render, **Then** they are ordered by the order column ascending (1, 2, 3, …) and every reserve returned by the API is shown, regardless of whether they have been moved to the main list.
4. **Given** a reserve prisoner has not been called up, **When** the row is displayed, **Then** the status Tag shows "Available as reserve".
5. **Given** a reserve prisoner has been called up as a replacement, **When** the row is displayed, **Then** the status Tag shows "Moved to main list".

---

### User Story 4 - Automatic replacement when a main list prisoner cannot be tested (Priority: P1)

When the officer marks a main-list prisoner as "Unable to test" and records a reason, the system automatically calls up the next available reserve — strictly the reserve with the lowest order number whose status is still "Available as reserve" — and adds them to the main list. The originally-selected main-list row remains visible, its action column is populated with "Replaced by reserve due to [reason]" using the reason recorded against them. Where the reason is "refusing the test", the action text is a link to the adjudication service. The promoted reserve appears on the main list with their Original list column set to "Reserve" and — because they are now the next reserve that must be tested — with a "Record test" action so the officer can go on to record their test. If a subsequent main-list prisoner is also marked "Unable to test", the next available reserve is likewise promoted; but because reserves must be tested strictly in order, only the earliest-promoted still-untested reserve gets the "Record test" action — any later promoted reserves show the action text "Test previous reserve first" instead, so the officer is enforced to work through them in order. On the reserve list tab, each promoted prisoner's status Tag changes to "Moved to main list" and they remain visible in their original order position.

**Why this priority**: This is the core operational rule of the two-list model — it is the reason the reserve list exists. Without it the reserve list is inert.

**Independent Test**: Given a main list and a reserve list, mark a main-list prisoner as "Unable to test" with a specified reason. Verify (a) the original row shows action "Replaced by reserve due to [reason]"; (b) if the reason is "refusing the test" the action text is a link to the adjudication service; (c) the lowest-order available reserve appears on the main list with Original list "Reserve" and action "Record test"; (d) that same prisoner still appears on the reserve list in their original order position with status "Moved to main list"; (e) no other reserve is called up. Then mark a second main-list prisoner as "Unable to test": verify a second reserve is promoted onto the main list with Original list "Reserve", the earlier-promoted reserve still shows "Record test", and the newly-promoted reserve shows action "Test previous reserve first".

**Acceptance Scenarios**:

1. **Given** a main-list prisoner is marked "Unable to test" with a reason, **When** the change is recorded, **Then** the reserve prisoner with the lowest order number whose status is "Available as reserve" is added to the main list with Original list set to "Reserve".
2. **Given** a main-list prisoner has been marked "Unable to test", **When** the main list is displayed, **Then** their action column shows "Replaced by reserve due to [reason]" reflecting the reason recorded against them.
3. **Given** a main-list prisoner has been marked "Unable to test" with the reason "refusing the test", **When** the main list is displayed, **Then** the action text is a link that takes the officer to the adjudication service.
4. **Given** a reserve prisoner has been promoted to the main list and is the earliest-promoted reserve that has not yet been tested, **When** the main list is displayed, **Then** their action column shows a "Record test" control that lets the officer record a test for them.
5. **Given** more than one reserve has been promoted to the main list, **When** the main list is displayed, **Then** only the promoted reserve with the lowest Reserve list order number that has not yet been tested shows the "Record test" action; every other promoted-and-not-yet-tested reserve shows the text "Test previous reserve first" in their action column.
6. **Given** a reserve prisoner has been promoted to the main list, **When** the reserve list is displayed, **Then** they still appear in their original order position with status "Moved to main list", and they are not offered as the next available reserve for any subsequent replacement.
7. **Given** every reserve is already "Moved to main list", **When** another main-list prisoner is marked "Unable to test", **Then** no further replacement is added and the officer is informed that no more reserves are available.

---

### User Story 5 - Start recording a test from the main list (Priority: P2)

For a prisoner whose status is "Not started", the action column offers a "Record test" control — with one exception: where multiple reserves have been promoted onto the main list, only the earliest-promoted still-untested reserve gets the "Record test" control; any later promoted reserves show "Test previous reserve first" instead, so reserves are always tested in strict order of their reserve-list Order number. Activating "Record test" takes the officer into the test-recording journey (delivered as a separate feature) where they will mark the prisoner as tested or not tested. On the current page this control is a clearly labelled entry point to that journey; the journey itself is out of scope for this feature.

**Why this priority**: Recording tests is the outcome of the whole page, but the recording journey itself is a separate feature; this story only guarantees the correct, clearly labelled entry point exists on the right rows.

**Independent Test**: With a main list containing at least one originally-selected "Not started" prisoner and at least two promoted-from-reserve "Not started" prisoners, verify (a) the originally-selected "Not started" row offers a "Record test" action, (b) the earliest-promoted reserve offers a "Record test" action, (c) the later-promoted reserve shows "Test previous reserve first", and (d) activating "Record test" navigates to the recording journey entry point.

**Acceptance Scenarios**:

1. **Given** an originally-selected main-list prisoner has status "Not started", **When** an officer with role `MANDATORY_DRUG_TESTING_RW` or `MANDATORY_DRUG_TESTING_RWU` views the row, **Then** the action column offers a "Record test" control.
2. **Given** a main-list prisoner has status "Not started", **When** a user with role `MANDATORY_DRUG_TESTING_RO` views the row, **Then** the action column shows "No action needed" instead of the "Record test" control.
3. **Given** a main-list prisoner has been marked "Unable to test", **When** the officer views the row, **Then** the "Record test" control is not offered on that row (the action column shows the replacement label instead).
4. **Given** a main-list prisoner has status "Sample taken", **When** the officer views the row, **Then** the action column shows "No action needed".
5. **Given** a promoted-from-reserve prisoner with status "Not started" is the earliest-promoted reserve that has not yet been tested, **When** an officer with role `MANDATORY_DRUG_TESTING_RW` or `MANDATORY_DRUG_TESTING_RWU` views the row, **Then** the action column offers a "Record test" control.
6. **Given** a promoted-from-reserve prisoner with status "Not started" is NOT the earliest-promoted still-untested reserve, **When** the officer views the row, **Then** the action column shows "Test previous reserve first" and no "Record test" control is offered — regardless of the viewer's role.
7. **Given** the officer activates the "Record test" control, **When** they follow it, **Then** they are taken to the entry point of the test-recording journey for that specific prisoner.

---

### User Story 6 - Understand how this month's lists were generated (Priority: P2)

Because the lists are randomly generated and not editable after generation, officers need to be able to inspect how the current month's lists came about — when they were generated, who by, and the parameters used — so they can trust and, if needed, evidence the selection. A "Details" component labelled "How are the testing lists ordered?" expands to show this information alongside short explanatory copy about how the service works.

**Why this priority**: Trust and auditability are critical for a mandatory testing regime, but officers can perform their daily task without expanding this component; it supports the primary flow rather than being part of it.

**Independent Test**: Load the page and expand the "How are the testing lists ordered?" details component. Verify the metadata table and the three explanatory sections are shown with the values returned for the current month and establishment.

**Acceptance Scenarios**:

1. **Given** the page has loaded, **When** the officer expands the "How are the testing lists ordered?" details component, **Then** a table is shown containing rows for: Generated time and date (formatted "{DD Mon YYYY}"), Generated by (formatted "{Last name, Initial.}"), Population over last 12 months at generation (average population), Percentage requested (percentage and count of prisoners), Reserve list size (percentage and count of prisoners), and Selection reference (random seed evidence).
2. **Given** the details component is expanded, **When** the officer reads its body copy, **Then** three explanatory sections are shown: "List generation" (explaining monthly generation, non-editability, and how main list size is derived from the 12-month average population), "Reserves" (explaining when reserves are used and the strict-order rule), and "Other testing methods" (stating this service handles random MDT only and that suspicion-based testing is not managed here).
3. **Given** the details component is collapsed by default, **When** the officer activates it via keyboard, **Then** it expands and its contents are announced to assistive technologies per the GDS Details pattern.

---

### User Story 7 - Page shell, chrome, and secondary actions (Priority: P2)

The page must sit inside the standard DPS chrome so officers get the familiar navigation, identity, and support they get across other DPS services. It also needs entry points to two functions that will be built in subsequent tickets — viewing previous months' lists, and printing the current list — so the design is complete and the buttons don't need to be added later.

**Why this priority**: Consistency with the rest of DPS is a baseline expectation, and the two buttons are visible on the design; they must be placed correctly now even though their behaviour lands in later tickets.

**Independent Test**: Load the page and verify DPS Header, DPS Footer, Breadcrumbs, page URL, page title, standard DPS content width, and both the "View previous months" and "Print testing list" buttons are present and reachable by keyboard.

**Acceptance Scenarios**:

1. **Given** the page loads, **When** the officer views it, **Then** the DPS Header and DPS Footer are rendered as they appear across other DPS services (e.g. Official Visits) and the content width matches other DPS services.
2. **Given** the page loads, **When** the officer inspects the URL, **Then** the URL path is `/mdt-list` (on the environment-appropriate host, e.g. `mdt-ui[-dev].hmpps.service.justice.gov.uk`).
3. **Given** the page loads, **When** the officer inspects the browser tab, **Then** the page title is "MDT list - Mandatory drug testing - DPS".
4. **Given** the page loads, **When** the officer views the top of the page, **Then** a Breadcrumbs component is rendered showing the path back to the Mandatory drug testing landing.
5. **Given** the page loads, **When** the officer views it, **Then** a "View previous months" button and a "Print testing list" button are present, styled per GDS, keyboard-reachable, and correctly labelled; their target behaviour is delivered by subsequent tickets and out of scope for this feature.

---

### Edge Cases

- The API returns 404 for the current month at the active establishment — the system automatically retries once with the previous month's list. If that succeeds, the previous month's lists are shown with a banner noting the fallback; the `<h1>` reflects the previous month. If it also returns 404, an empty-state page is shown with the exact message "No lists currently exist for this prison, please contact your MDT Coordinator to generate a new list".
- The API is unavailable or times out (5xx / network / auth) — the page communicates that the list could not be loaded and offers a way to retry rather than presenting a partial or stale list. 5xx does NOT trigger the previous-month fallback (that is reserved for 404 only).
- Multiple main-list prisoners are marked "Unable to test" in quick succession — each mark-up promotes the next available reserve in strict order, one per unable-to-test prisoner.
- A reserve is promoted and then the original main-list prisoner's "Unable to test" decision is reversed — behaviour in this case is not defined by this feature and is called out in Assumptions for future clarification.
- The active establishment is switched while the page is open — the page reloads the correct month's lists for the new establishment before allowing any action.
- The officer has no active establishment set on their profile — the page cannot render lists and explains what the officer needs to do.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The page MUST display a header identifying the month the lists cover and the prison establishment currently active for the signed-in officer.
- **FR-002**: The page MUST present the prisoners as two tabbed lists — a Main list and a Reserve list — using the GOV.UK Tabs component, with each list rendered using the MOJ Design System Sortable table (Main list) and Table (Reserve list) components; status values MUST be rendered using the Tag component.
- **FR-003**: The Main list MUST show one row per prisoner with the following columns, in this order: Prisoner (last name, first name, with prisoner number underneath), Original list ("Main" or "Reserve"), Location (the prisoner's current cell location within the establishment; displayed verbatim from the API, e.g. "A-03-091" or "RECP"), Release date (CRD) (formatted "{DD Mon YYYY}"; where no CRD is recorded — e.g. NOMIS-only entries — the cell MUST display "No data available"), Last selected month (formatted "{Month YYYY}" of the most recent recorded test at any prison, or "Not tested before" if none exists), Status, and Action.
- **FR-004**: The Reserve list MUST show one row per prisoner with the following columns, in this order: Order, Prisoner (last name, first name, with prisoner number underneath), Location, Last selected month, and Status; it MUST NOT show an Original list, Action, or any other column.
- **FR-005**: Every column on the Main list except Action MUST be sortable ascending and descending, and the current sort state MUST be visually indicated. Sort semantics per column MUST follow the rules in User Story 2. All rows on the Main list — including those whose Original list is "Reserve" — participate in the sort on equal terms; there is NO sticky positioning of any row.
- **FR-006**: No column on the Reserve list MUST be sortable; the Reserve list MUST always be displayed ordered by the Order column ascending. Every reserve returned by the API MUST be shown on this tab, whether or not they have been moved to the main list.
- **FR-007**: The page MUST source both lists for the current month and active establishment from the prisoner list API; no locally curated lists are permitted. The lists MUST NOT be editable after generation. When the API returns 404 for the current month, the FE MUST retry ONCE for the previous month (`YYYY-MM` minus one, rolling the year at January); if that call succeeds the FE MUST render that list with a fallback banner and set the `<h1>` to the fallback month; if that call also returns 404 the FE MUST render an empty-state view with the exact message "No lists currently exist for this prison, please contact your MDT Coordinator to generate a new list". A 200 response is guaranteed by the BE to contain non-empty `mainList` and `reserveList` collections.
- **FR-008**: When a Main list prisoner is marked "Unable to test" with a reason, the system MUST call up the Reserve prisoner with the lowest Order whose status is "Available as reserve", add them to the Main list with Original list set to "Reserve", and update that Reserve prisoner's status on the Reserve list to "Moved to main list" while keeping them visible in their original Order position.
- **FR-009**: On the Main list, a prisoner who has been marked "Unable to test" MUST display an action of the form "Replaced by reserve due to [reason]", where [reason] is derived from the reason recorded against them. Where the reason is "refusing the test", the action text MUST be a link to the adjudication service. The promoted Reserve prisoner that took their place MUST display either "Record test" or "Test previous reserve first" per FR-011.
- **FR-010**: The set of "Unable to test" reasons MUST be a fixed list owned by the BE. On the list API the reason is returned as a code (`reasonNotTested`); display text for the "Replaced by reserve due to [reason]" action is resolved by calling a separate BE reference-data endpoint (`GET /reference-data/tested-reasons` — response shape `[{ code, description }, ...]`, no URL field). The FE MUST be built against this endpoint. Where the resolved reason is code `REFUSE`, the FE MUST render the action as a link whose destination is derived FE-side from the `MANAGE_ADJUDICATIONS_URL` environment variable (dev default `https://manage-adjudications-dev.hmpps.service.justice.gov.uk/incident-details/{prisonerNumber}`, with the row's `prisonerNumber` substituted at render time). The reference-data endpoint has not yet been implemented, but no live records currently carry a `reasonNotTested` value, so the FE will not exercise the call in current data conditions.
- **FR-011**: For a Main list prisoner whose Status is "Not started", the Action column MUST render as follows:
  - If the row is an originally-selected Main entry (Original list = "Main"), it MUST show a "Record test" control that navigates to the test-recording journey.
  - If the row is a promoted Reserve entry (Original list = "Reserve") AND it is the earliest-promoted still-untested reserve, it MUST show a "Record test" control.
  - If the row is a promoted Reserve entry AND at least one earlier-promoted reserve on the Main list has not yet been tested, it MUST show the text "Test previous reserve first" and MUST NOT offer the "Record test" control — regardless of the viewer's role.
  The test-recording journey itself is delivered separately.
- **FR-012**: When every reserve on the Reserve list has status "Moved to main list", the system MUST NOT attempt any further replacement and MUST inform the officer that no reserves remain.
- **FR-013**: The page MUST meet WCAG 2.1 AA, including keyboard-only operation of tabs, sort controls, the Details component, and row actions, and MUST correctly announce sort state, tab changes, Details expansion/collapse, and Status/Action changes to assistive technologies.
- **FR-014**: All design and interaction decisions in this feature MUST be traceable to the supplied designs and user research; any deviation from user research MUST be surfaced back to the team for confirmation before implementation. Design screenshots and user research can be found in `specs/001-prisoner-testing-lists/research/*`. Technical dependencies (API endpoint, auth pattern, role gating, reference repo patterns, file-level intent) are captured in `specs/001-prisoner-testing-lists/research/technical-brief.md`.
- **FR-015**: The Reserve list tab MUST display an H2 "Reserve list" and an introductory paragraph — "Reserves are used when a main-list prisoner cannot be tested. They need to be tested in list order if used." — above the table.
- **FR-016**: A Reserve list prisoner's status MUST be one of "Available as reserve" (not yet called up) or "Moved to main list" (called up); for the purposes of this feature, transitions on the Reserve list are one-way.
- **FR-017**: The Main list Status column MUST render one of exactly three values using the Tag component: "Not started", "Sample taken", or "Unable to test".
- **FR-018**: The Main list Action column MUST render one of the following values only, driven by Status, Original list, and (for promoted reserves) reserve ordering: "Record test" (link — when Status is "Not started" and the row is either an originally-selected Main entry or the earliest-promoted still-untested Reserve entry), "Test previous reserve first" (text — when Status is "Not started" and the row is a promoted Reserve entry that is NOT the earliest-promoted still-untested reserve), the text "No action needed" (when Status is "Sample taken"), or "Replaced by reserve due to [reason]" (when Status is "Unable to test"; a link to the adjudication service where the reason is "refusing the test").
- **FR-019**: The Main list MUST be paginated at 50 prisoners per page; sorting MUST be applied across the whole list (not just the visible page) and pagination controls MUST be keyboard-operable and follow GDS pagination guidance.
- **FR-020**: The page MUST render inside the standard DPS chrome — DPS Header, DPS Footer, and standard DPS content width — as used by other DPS services (e.g. Official Visits); it MUST include a Breadcrumbs component at the top of the content area.
- **FR-021**: The page URL MUST be `/mdt-list` on the environment-appropriate host (e.g. `mdt-ui[-dev].hmpps.service.justice.gov.uk/mdt-list`), and the page title MUST be "MDT list - Mandatory drug testing - DPS".
- **FR-022**: The page MUST render a caption in the format "HMP {Prison Name}" showing the officer's current prison caseload, and an H1 in the format "{Month} {Year}" showing the month the lists cover.
- **FR-023**: Above the Main list table the page MUST render an H2 "Main list" followed by three summary blocks: **Completed** (count of rows whose Status is "Sample taken" or "Unable to test"), **Releasing this month** (count of rows whose release date falls within the calendar month the list covers), and **Tested on weekend** (count of rows whose test for this month's list was recorded on a Saturday or Sunday).
- **FR-024**: The page MUST render a Details component labelled "How are the testing lists ordered?" containing a table with the following rows — Generated time and date (format "{DD Mon YYYY}"), Generated by ("{Last name, Initial.}"), Population over last 12 months at generation (average population), Percentage requested (percentage and count), Reserve list size (percentage and count), and Selection reference (random seed evidence) — plus three body copy sections: "List generation", "Reserves", and "Other testing methods" (exact wording per the ticket and design).
- **FR-025**: The page MUST render a "View previous months" button and a "Print testing list" button, placed per the design, keyboard-reachable and correctly labelled; the target behaviour of both buttons is delivered by subsequent tickets and is out of scope for this feature.
- **FR-026**: A notification badge is not required for this feature; if the design later calls for one it will be added in a follow-up ticket.
- **FR-027**: The Location column MUST show the prisoner's current cell location as returned by the API at page-load time (i.e. live location, not a snapshot from list generation).
- **FR-028**: Any sort applied on the Main list MUST be preserved across tab switches within the same page instance; sort state MUST reset to the default (API-preserved order with promoted reserves at the bottom) on page reload or navigation away and back.
- **FR-029**: Access to the page MUST be gated by role. Users with role `MANDATORY_DRUG_TESTING_RO` MUST be able to view the page (both tabs, all data, the Details component, and both buttons subject to their own feature) but MUST NOT be able to activate the "Record test" action; for these users the Action cell for "Not started" rows MUST render as "No action needed" (or equivalent read-only treatment) instead of the "Record test" link. Users with role `MANDATORY_DRUG_TESTING_RW` or `MANDATORY_DRUG_TESTING_RWU` MUST see and be able to activate the "Record test" action, except where FR-011 dictates the row shows "Test previous reserve first" — that ordering constraint applies to all writer roles. Users with none of these roles MUST NOT be able to access the page.

### Key Entities *(include if data involved)*

- **Monthly Testing List**: The scoped set of prisoners for one month at one establishment, together with the metadata about how it was generated. Has a month, an establishment, a Main list, a Reserve list, and generation metadata (generated at, generated by, average population, percentage requested, reserve list size, selection reference).
- **Main List Entry**: A prisoner shown on the Main list. Attributes: last name, first name, prisoner number, original list ("Main" or "Reserve" — set to "Reserve" when the entry was moved to the main list from the Reserve list), location (current cell location within the establishment), release date (CRD, may be absent), last selected month (may be "Not tested before"), status ("Not started" / "Sample taken" / "Unable to test"), action state, and — if the officer marked them "Unable to test" — the reason recorded against them.
- **Reserve List Entry**: A prisoner on the Reserve list. Attributes: last name, first name, prisoner number, location (current cell location within the establishment), last selected month (may be "Not tested before"), order number, and status ("Available as reserve" or "Moved to main list"). Always visible on the Reserve list regardless of whether they have been called up.
- **Unable to Test Reason**: A value from a fixed set that explains why a Main list prisoner could not be tested; the same value populates the "Replaced by reserve due to [reason]" action on the original row (and, where the reason is "refusing the test", renders the action as a link to the adjudication service).
- **Establishment**: The prison currently active for the signed-in officer; determines which lists are shown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Officers can identify the correct month and establishment from the page header within 5 seconds of the page loading, verified in usability testing with at least 5 officers.
- **SC-002**: In usability testing, at least 90% of officers correctly locate a specific prisoner on the Main list by sorting a chosen column, on their first attempt, without assistance.
- **SC-003**: In usability testing, at least 90% of officers correctly identify who the next reserve to be called up would be, on their first attempt.
- **SC-004**: When a Main list prisoner is marked "Unable to test", the promoted reserve appears on the Main list within 2 seconds in 95% of cases; the reason shown in the "Replaced by reserve due to [reason]" action matches the reason recorded 100% of the time; and the promoted reserve's Reserve list status shows "Moved to main list" 100% of the time.
- **SC-005**: The page passes automated WCAG 2.1 AA scans with zero critical or serious issues and is fully operable by keyboard.
- **SC-006**: In usability testing, at least 90% of officers correctly locate the "Record test" entry point for a "Not started" prisoner on their first attempt.

## Assumptions

- The prisoner list API returns both the Main list and the Reserve list, already scoped to the month and the active establishment, with the reserve list carrying its priority order; this feature does not compute or curate either list.
- The active establishment for the officer is provided by the existing HMPPS authentication/profile context and does not need to be selected on this page.
- Sorting operates across the whole list returned for the current month, but rows are paginated at 50 per page (see FR-019); this feature does not lazy-load.
- The set of "Unable to test" reasons is BE-owned. The list API returns a code (`reasonNotTested`); the FE resolves display text by calling `GET /reference-data/tested-reasons` on the MDT API (response shape `[{ code, description }, ...]`, no URL field). Where the code is `REFUSE`, the FE renders the action as a link whose destination is derived from the `MANAGE_ADJUDICATIONS_URL` environment variable (dev default `https://manage-adjudications-dev.hmpps.service.justice.gov.uk/incident-details/{prisonerNumber}`, with the row's `prisonerNumber` substituted). The reference-data endpoint has not yet been implemented BE-side, but no live records carry a `reasonNotTested` value so the FE will not exercise the call in current data conditions (see `research/technical-brief.md` §7).
- Reversing an "Unable to test" decision after a reserve has been promoted is out of scope for this feature and will be clarified in a later feature; for now the promotion stands and the promoted reserve keeps their place on the Main list.
- The test-recording journey triggered by the "Record test" action is delivered as a separate feature; this feature only guarantees the entry point.
- The behaviour behind the "View previous months" and "Print testing list" buttons is delivered by subsequent tickets; this feature only guarantees the buttons are present and correctly placed and labelled.
- The GOV.UK Tabs component is acceptable per the constitution's "MOJ patterns first, GOV.UK fallback" rule because MOJ does not provide a tabs pattern; if a MOJ tabs equivalent exists, it will be used instead.
- The prisoner name shown as a hyperlink in the supplied designs is out of scope for this feature; linking behaviour on the prisoner name will be defined in a later feature. For now the prisoner name is presented as text.
- Column terminology follows the design screenshot (`research/designs/Screenshot 2026-09-07 at 14.10.26.png`), confirmed 2026-09-09: the "last tested" column is called **"Last selected month"** and the reserve status Tag for a called-up reserve is **"Moved to main list"**. Where the ticket AC used "Last tested month" / "Called from reserve", the screenshot wording supersedes it.
- All design and copy decisions will be confirmed against the supplied designs and user research before build; the requirements above capture behaviour, not visual or copy specifics.
