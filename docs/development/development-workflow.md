# Development Workflow & Git Standards

> **Status:** Engineering Standard / Pre-Implementation Baseline
> **Repository:** [Heyyprakhar1/Queless-Bharat](https://github.com/Heyyprakhar1/Queless-Bharat)

---

## 1. Branching Strategy

The repository follows a clean, branch-per-change workflow anchored on a protected mainline.

### Primary Branch
- **`main`**: The canonical integration branch. All code reaching `main` must pass local verification, CI checks, and code review. Code on `main` is expected to remain always deployable.

### Topic Branch Prefixes
Direct commits to `main` are restricted. All development must occur on dedicated branches using standardized prefixes:

| Branch Prefix | Usage | Example |
| :--- | :--- | :--- |
| `feature/*` | New functional capabilities or endpoints | `feature/wait-time-estimator` |
| `fix/*` | Bug fixes or issue resolution | `fix/counter-status-transition` |
| `docs/*` | Architecture, ADR, or documentation updates | `docs/testing-strategy` |
| `infra/*` | Infrastructure, Terraform, or cloud configuration | `infra/vpc-subnets` |
| `test/*` | Adding or refactoring test suites | `test/queue-engine-edge-cases` |
| `chore/*` | Dependency updates, tooling, or setup tasks | `chore/initial-setup` |
| `refactor/*` | Code improvements without altering behavior | `refactor/api-route-modularization` |

---

## 2. End-to-End Lifecycle Workflow

Every change follows an explicit, disciplined progression:

```
1. Create Branch (from updated main)
       │
       ▼
2. Local Development & Verification (linting, tests, type checks)
       │
       ▼
3. Commit (Conventional Commits formatting)
       │
       ▼
4. Push Topic Branch to GitHub Remote
       │
       ▼
5. Open Pull Request (PR template, clear description)
       │
       ▼
6. Automated CI Validation (test suite, linting, security scans)
       │
       ▼
7. Code Review & Approval
       │
       ▼
8. Merge to main (Squash & Merge preferred)
       │
       ▼
9. Delete Topic Branch
```

---

## 3. Conventional Commit Guidelines

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<optional scope>): <short description in present tense>

[optional body explaining rationale and context]

[optional footer(s) referencing issue numbers]
```

### Allowed Types
- **`feat:`** Introduces a new feature or endpoint.
- **`fix:`** Patches a bug or resolves an issue.
- **`docs:`** Documentation changes only.
- **`infra:`** Terraform, cloud topology, or container/environment configuration changes.
- **`test:`** Adds missing tests or fixes existing test cases.
- **`chore:`** Maintenance tasks, build tooling, or dependency version upgrades.
- **`refactor:`** Code restructuring that neither fixes a bug nor adds a feature.

### Commit Rules
- Commit messages should be concise, professional, and explain *why* a change was made rather than simply restating the diff.
- Never bundle unrelated changes (e.g., mixing infrastructure changes with documentation or feature additions) in a single commit.
- **Zero Secrets Rule:** Never include credentials, private keys, or API tokens in any commit.

---

## 4. Pull Request Standards

- **Small, Focused Scope:** PRs should address a single logical change or issue to facilitate thorough, high-quality review.
- **Clear Descriptions:** PR descriptions must describe what was changed, why, and how the changes were verified locally.
- **Branch Cleanliness:** Rebase or merge from upstream `main` to resolve conflicts before requesting final review.
