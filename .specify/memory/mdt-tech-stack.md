# Tech Stack

This file is the **team-supplied companion** to the project constitution at
[`.specify/memory/constitution.md`](.specify/memory/constitution.md).

The constitution defines *what* the team must do (principles, workflow, governance). This file
defines *with what* — the specific tools, frameworks, and quality thresholds in use. To adopt the
constitution for a different project or team, replace the contents of this file; the constitution
itself does not need to change.

---

## Backend

| Concern | Tool / Technology |
|---------|-------------------|
| Language | Kotlin (JVM) |
| Framework | Spring Boot |
| Testing | JUnit Jupiter + AssertJ |
| Linting | Ktlint |
| Deployment | Docker containers orchestrated via Kubernetes |

## Frontend

| Concern | Tool / Technology |
|---------|-------------------|
| Language | TypeScript (strict mode enabled) |
| Framework | Express + Nunjucks (server-side rendered) |
| Unit / Integration Testing | Jest |
| End-to-End Testing | Cypress |
| Linting | ESLint |
| Build Tool | Webpack |
| Deployment | Docker containers orchestrated via Kubernetes |

## Quality Thresholds

| Metric | Threshold |
|--------|-----------|
| Minimum line coverage — backend | 90% |
| Minimum line coverage — frontend | 90% |

> Thresholds are enforced in CI. No code may be merged without meeting these thresholds.

---

## Amendment

Changes to this file (adding/removing tools, adjusting thresholds) follow the same amendment
procedure as the constitution: raise a PR, include change rationale, obtain tech lead sign-off
plus 1 peer approval.
