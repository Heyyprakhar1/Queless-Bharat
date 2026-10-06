# Contributing to QueueLess Bharat

Welcome to the QueueLess Bharat project! We appreciate contributions that help bring transparency and predictability to civic waiting times across India.

To maintain code quality, security, and architectural integrity, all contributors and engineering agents are expected to follow these guidelines.

---

## 1. Getting Started & Principles

- **Read the Architecture:** Before implementing features or making significant changes, review the foundational documentation in [`docs/architecture/`](file:///home/prakhar/Queless-Bharat/docs/architecture/) and [`docs/decisions/`](file:///home/prakhar/Queless-Bharat/docs/decisions/).
- **Small, Focused Changes:** Submit small, incremental pull requests addressing one specific problem or feature rather than sprawling, monolithic changes.
- **Architectural Alignment:** Significant architectural or technology changes must be proposed via an Architectural Decision Record (ADR) under [`docs/decisions/`](file:///home/prakhar/Queless-Bharat/docs/decisions/).

---

## 2. Branching & Git Workflow

All work must occur on dedicated topic branches created from an up-to-date `main` branch.

### Branch Naming Conventions
Use clear, descriptive branch names prefixed with the change category:

- `feature/<name>` — New capabilities or endpoints (e.g., `feature/queue-status-endpoint`)
- `fix/<name>` — Bug fixes (e.g., `fix/counter-session-timeout`)
- `docs/<name>` — Documentation updates (e.g., `docs/update-architecture`)
- `infra/<name>` — Terraform, AWS, or deployment setup (e.g., `infra/alb-routing`)
- `test/<name>` — Adding or improving test suites (e.g., `test/queue-engine-invariants`)
- `chore/<name>` — Tooling, dependency maintenance (e.g., `chore/linting-config`)
- `refactor/<name>` — Internal restructuring without behavioral change

---

## 3. Commit Message Conventions

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <concise description in present tense>
```

Examples:
- `feat(api): add queue session lookup by location`
- `fix(engine): correct confidence calculation when sample size is low`
- `docs(adr): document decision on polling strategy`
- `infra(terraform): add private subnet configurations`

---

## 4. Pull Request (PR) Expectations

When opening a Pull Request:
1. **Title & Summary:** Use a conventional commit title and provide a clear description of *what* changed, *why* it was changed, and any design tradeoffs considered.
2. **Local Verification:** Confirm that all linting, unit tests, and formatters pass locally before pushing.
3. **No Unrelated Edits:** Keep diffs clean and free of formatting changes to untouched files.
4. **Clean History:** Keep commits logical and clean. Avoid committing work-in-progress or "fix typo" churn; squash or rebase when appropriate.

---

## 5. Security & Privacy Non-Negotiables

- **Zero Secrets in Git:** Never commit `.env` files, passwords, access keys, or credentials. Use `.env.example` for templates with dummy placeholders.
- **Data Minimization:** Never store or log sensitive citizen PII (such as Aadhaar numbers or medical records).
- **Sanitized Logging:** Ensure logs do not print authentication headers or sensitive parameters.

---

## 6. Testing & Documentation Standards

- **Tests Required:** Any new domain logic, queue estimation changes, or API endpoints must be accompanied by unit and integration tests.
- **Queue Correctness:** Tests must verify edge cases (zero active counters, concurrent updates, boundary values, transaction rollbacks).
- **Keep Documentation Synchronized:** If code changes modify API schemas, configurations, or operational assumptions, update the corresponding documents under [`docs/`](file:///home/prakhar/Queless-Bharat/docs/).
