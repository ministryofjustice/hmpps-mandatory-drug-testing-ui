# HMPPS M&I Squad 3 Constitution

> **Tech Stack Reference**: This constitution is technology-agnostic. All specific tools,
> frameworks, and quality thresholds (including the minimum coverage threshold) are defined in
> [`.specify/memory/mdt-tech-stack.md`](.specify/memory/mdt-tech-stack.md), which MUST be read
> alongside this constitution. To adopt this constitution for a new team or project, replace that
> file — this document does not need to change.

## Core Principles

### I. Test-Driven Development (NON-NEGOTIABLE)

TDD MUST be applied to all code changes. The Red-Green-Refactor cycle MUST be strictly followed:
tests are written and approved before implementation begins, tests MUST fail first, then
implementation satisfies them, then code is refactored.

- Backend and frontend MUST use the testing frameworks defined in the tech stack; the minimum
  line coverage threshold is specified there and MUST be enforced in CI
- Integration tests MUST be written where services interact (e.g. inter-service HTTP calls, shared
  schemas, database contracts); e2e tests MUST be written where a full user journey can be exercised
- No code may be merged without passing tests and meeting the coverage threshold
- AI-generated code is subject to the same TDD discipline — tests MUST be written before or
  alongside any AI-suggested implementation

### II. Security First (NON-NEGOTIABLE)

All services MUST be secured using the HMPPS OAuth2/SSO server.

- SSO integration details are private — credentials and endpoint config MUST be requested from the
  HMPPS platform team and MUST NEVER be hardcoded or committed to version control
  `TODO(OAUTH2_ENDPOINT)`: details withheld per HMPPS privacy policy
- OWASP Top 10 vulnerabilities MUST be addressed in all code; CI security scans MUST pass
- Secrets MUST be managed via Kubernetes Secrets or an approved secrets management service;
  MUST NOT be stored in source control or environment files checked in to repos
- All dependency updates MUST be reviewed for CVEs before merging

### III. Accessibility & GDS Standards (NON-NEGOTIABLE)

All user-facing outputs MUST:

- Be WCAG 2.1 AA compliant as a minimum (AAA where achievable)
- Be tested with assistive technologies: screen readers, keyboard-only navigation, and colour
  contrast validation tools
- Use [MOJ Design Patterns](https://design-patterns.service.justice.gov.uk/) as the primary
  component library; fall back to the
  [GOV.UK Design System](https://design-system.service.gov.uk/) where MOJ patterns do not cover
  the use case
- Accessibility acceptance criteria MUST be present in every feature spec that produces UI output
- Automated WCAG scans (e.g. axe-core / pa11y) MUST be included in the CI pipeline and MUST pass

### IV. Backend Technology Stack

All backend microservices MUST use the language, framework, testing tool, and linting tool
defined in [`.specify/memory/mdt-tech-stack.md`](.specify/memory/mdt-tech-stack.md):

- **Language**: as specified in the tech stack
- **Framework**: as specified in the tech stack
- **Testing**: as specified in the tech stack; coverage threshold MUST meet the threshold defined
  there and MUST be enforced in CI
- **Linting**: as specified in the tech stack — enforced in CI; build MUST fail on violations
- **Deployment**: containerised and orchestrated as specified in the tech stack

Deviations require an amendment to `.specify/memory/mdt-tech-stack.md` following the amendment
procedure in Governance.

### V. Frontend Technology Stack

All frontend services and applications MUST use the language, framework, testing tools, linting
tool, and build tool defined in
[`.specify/memory/mdt-tech-stack.md`](.specify/memory/mdt-tech-stack.md):

- **Language**: as specified in the tech stack (strict mode MUST be enabled where the language
  supports it)
- **Framework**: as specified in the tech stack
- **Unit/Integration Testing**: as specified in the tech stack; coverage threshold MUST meet the
  threshold defined there and MUST be enforced in CI
- **End-to-End Testing**: as specified in the tech stack
- **Linting**: as specified in the tech stack — enforced in CI; build MUST fail on violations
- **Build Tool**: as specified in the tech stack
- **Deployment**: containerised and orchestrated as specified in the tech stack

Deviations require an amendment to `.specify/memory/mdt-tech-stack.md` following the amendment
procedure in Governance.

### VI. AI-Augmented Development

The squad extends the SDLC to support developers, UI designers, and UX practitioners using AI.

**Approved tool**: GitHub Copilot (MOJ-approved). No other AI tool may be used without an explicit
security review and a constitution amendment.

Rules — these apply to all squad members regardless of role:

- MUST NOT include PII, prisoner data, credentials, API keys, secrets, or production data in any
  AI prompt or AI tool input
- MUST NOT rely on AI output without human review — all AI-generated code, designs, and content
  MUST be reviewed before merging or publishing
- AI-assisted UI/UX outputs MUST still conform to WCAG 2.1 AA and GDS/MOJ design standards —
  AI tools do not exempt outputs from compliance checks
- AI suggestions touching authentication, authorisation, or security-critical paths require
  additional tech lead review before merging

### VII. Microservice Architecture & Versioning

- Services MUST be independently deployable, independently testable, and loosely coupled
- All services MUST follow **SemVer** (MAJOR.MINOR.PATCH):
  - MAJOR: breaking API change
  - MINOR: backward-compatible feature addition
  - PATCH: backward-compatible bug fix
- Each service MUST expose a `/health` endpoint
- Inter-service communication contracts MUST be documented (e.g. OpenAPI / AsyncAPI) before
  implementation begins

### VIII. Observability

All services MUST integrate with the HMPPS platform observability stack:

- **Metrics**: Prometheus
- **Dashboards & Alerting**: Grafana
- **Log Aggregation**: Kibana
- Logs MUST be structured (JSON) and MUST include a correlation ID
- Logs MUST NOT contain PII, prisoner data, or secrets
- Services MUST emit health, error-rate, and latency metrics

## Development Workflow

- **Branching**: Feature branches named `[###-feature-name]` branched from `main`
- **Pull Requests**: Minimum 1 peer approval + all CI gates green before merge
- **CI Gates** — all MUST pass before merge:
  - Linting (tool defined in tech stack)
  - Unit + integration tests meeting the coverage threshold defined in the tech stack
  - End-to-end tests (tool defined in tech stack)
  - Automated WCAG scan (axe-core / pa11y)
  - Dependency CVE / security scan
- **Infrastructure or security changes**: require tech lead sign-off in addition to peer approval
- **Commit messages**: Conventional Commits format (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)

## AI SDLC Integration Policy

The squad extends the standard SDLC to include AI assistance at design and development stages:

- UI/UX designers MAY use GitHub Copilot to generate layout suggestions, component sketches, and
  accessibility annotations — subject to human review and compliance checks
- Engineers MAY use GitHub Copilot for code completion, test generation, and documentation
- MUST NOT include PII, prisoner data, credentials, secrets, or production data in any AI prompt
- All AI-generated outputs MUST be reviewed by a human before merging or publishing
- Decisions about AI tooling that affect the SDLC MUST be documented and shared across the squad

## Governance

- This constitution supersedes all other local practices and informal agreements
- **Amendment procedure**: raise a PR against `.specify/memory/constitution.md`, include change
  rationale, obtain tech lead sign-off plus 1 peer approval, increment version per the SemVer
  policy below
- **Constitution versioning** (SemVer):
  - MAJOR: principle removal, redefinition, or incompatible governance change
  - MINOR: new principle or section added, or materially expanded guidance
  - PATCH: clarification, wording fix, or non-semantic refinement
- **Compliance review**: CI enforces technical gates automatically; human reviewers MUST verify
  non-automated gates (accessibility design review, GDS/MOJ pattern compliance, AI output review)
  at PR time
- `TODO(OAUTH2_ENDPOINT)`: HMPPS OAuth2/SSO server credentials and endpoint configuration are
  withheld per HMPPS privacy policy — request from the HMPPS platform team when implementing
  secure endpoints

**Version**: 1.0.0 | **Ratified**: 2026-07-16 | **Last Amended**: 2026-07-16
