# AGENTS.md

## Purpose

This document defines the development workflow and coding standards that all AI coding agents must follow when contributing to this repository.

These rules are mandatory unless explicitly overridden by project-specific instructions.

---

# Package Management

## Preferred Package Manager

* Always use nub as the default package manager and runtime unless the project explicitly specifies another package manager
* **Always use `pnpm`** as the second option package manager unless the project explicitly specifies another package manager.
* Do **not** use `npm` or `yarn` unless required by the project.
* For Bun-based projects, use `bun` for package management and project scripts.

---
Always use `uv` as the default python package manager unless the project explicitly specifies another package manager

# Git Workflow

## Repository Initialization

Before making any changes:

1. Check whether the project is already a Git repository.
2. If no repository exists:

   * Run `git init`.
   * Create an initial commit before implementing features.
3. If a repository already exists:

   * Check for uncommitted changes.
   * Commit the current working tree before starting new work.

Never begin feature development on top of unrelated uncommitted changes.

---

## Branches

* Do not work directly on the default branch if feature branches are already part of the project's workflow.
* Prefer creating a dedicated feature branch when appropriate.

---

## Before Starting Work

For existing repositories:

1. Pull the latest changes.
2. Rebase if necessary.
3. Resolve conflicts before implementing new features.

---

# Feature Development Workflow

Implement work **one feature at a time**.

For every feature:

1. Understand the existing implementation.
2. Plan the implementation.
3. Implement only that feature.
4. Verify functionality.
5. Run all required checks.
6. Commit with a descriptive commit message.
7. Move on to the next feature.

Never implement multiple unrelated features in one commit.

---

# Code Quality

Before every commit, ensure the project is free from compilation and linting errors.

## TypeScript

For Node.js projects:

```bash
npx tsc --noEmit
```

For Bun projects:

```bash
bun tsc --noEmit
```

## ESLint

```bash
npx eslint . --ext .ts,.tsx
```

No TypeScript or ESLint errors should remain.

---

# Testing

If the project contains tests:

* Run the relevant test suite.
* Ensure all tests pass.
* Do not skip failing tests.
* Do not disable tests simply to make the build pass.

---

# Build Verification

When applicable, ensure the project successfully builds before committing.

Examples:

```bash
pnpm build
```

or

```bash
bun run build
```

---

# Commit Policy

Every commit should represent **one logical change**.

Use **Conventional Commits**.

Examples:

```text
feat: add authentication middleware
feat: implement profile settings page
fix: resolve login validation bug
refactor: simplify database queries
docs: update installation instructions
style: format components
test: add API integration tests
chore: update dependencies
```

Commit immediately after a feature has been verified.

Avoid "misc changes" or "update" commit messages.

---

# Dependency Management

Before installing a dependency:

* Check whether an existing dependency already solves the problem.
* Avoid unnecessary packages.
* Prefer lightweight, actively maintained libraries.
* Remove unused dependencies.

---

# Documentation

Whenever functionality changes:

* Update relevant documentation.
* Update README files when installation or usage changes.
* Document new environment variables.
* Document breaking changes.

---

# Code Style

Always:

* Follow the existing architecture.
* Follow existing naming conventions.
* Keep functions small and focused.
* Prefer composition over duplication.
* Keep files organised.
* Write self-documenting code.
* Maintain strict type safety.
* Avoid `any` unless absolutely necessary.

---

# Refactoring

When touching existing code:

* Improve readability where practical.
* Remove dead code.
* Remove obsolete comments.
* Simplify overly complex logic without changing behaviour.

Avoid large refactors unless explicitly requested.

---

# Performance

Prefer solutions that:

* Avoid unnecessary re-renders.
* Minimise unnecessary allocations.
* Reduce repeated computations.
* Scale well for larger datasets.

Optimise only when it improves maintainability or measurable performance.

---

# Security

Never:

* Commit secrets.
* Commit API keys.
* Commit `.env` files.
* Hardcode credentials.
* Disable authentication checks.

Validate all user input.

---

# Error Handling

* Handle expected failures gracefully.
* Return meaningful error messages.
* Avoid silent failures.
* Prefer typed errors where appropriate.

---

# Pull Requests

Before opening a pull request:

* Ensure all checks pass.
* Ensure the project builds successfully.
* Ensure tests pass.
* Remove debugging code.
* Remove commented-out code.
* Ensure documentation is updated.

---

# General Principles

Always:

* Think before coding.
* Prefer maintainability over cleverness.
* Keep commits small and atomic.
* Preserve backwards compatibility unless intentionally introducing breaking changes.
* Reuse existing utilities before creating new ones.
* Avoid premature abstraction.
* Avoid unnecessary dependencies.
* Leave the codebase cleaner than you found it.
* Ensure the repository remains in a working state after every commit.
* Always Update the Readme and Technical Docs as you Progress

The repository should always be in a state where another developer can pull the latest commit and successfully build, lint, and continue development without additional fixes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
