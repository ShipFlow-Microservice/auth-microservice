# AGENTS.md

## Commands

```bash
# Development
npm run start:dev      # Watch mode
npm run build          # Build (cleans dist/ first)

# Code quality
npm run lint           # Oxlint (NOT ESLint)
npm run format         # Prettier

# Testing
npm run test           # Unit tests (*.spec.ts)
npm run test:e2e       # E2E tests (test/*.e2e-spec.ts)
```

## Stack

- **NestJS 12** with TypeScript 6 (ES2023 target)
- **Oxlint** for linting (config: `oxlint.json`) - `no-explicit-any` disabled, `no-floating-promises` warns
- **Prettier** (single quotes, trailing commas)
- **Jest 30** for testing (unit and E2E use separate configs)

## Architecture

Single microservice (not monorepo). Structure:
- `src/main.ts` - Entry point, port from `PORT` env or 3000
- `src/app.module.ts` - Root module
- `src/auth/` - Auth feature (controller, service, module)
- `specs/` - Feature specifications, implementation plans, and design documents
- `test/` - E2E tests only

## Specifications and Plans

All feature specifications, implementation plans, and design documents must be stored in the `specs/` directory at the project root. This includes:
- Implementation plans (Markdown files with step-by-step guides)
- Feature specifications and requirements
- Architecture decision records
- Design documents

When creating new specs, always place them in `specs/` rather than external directories.

## Gotchas

- Jest reads TypeScript path aliases from `tsconfig.json` (see `jest.config.ts`)
- `deleteOutDir: true` in `nest-cli.json` means `dist/` is wiped on every build
- E2E tests use `test/jest-e2e.json`, not the root `jest.config.ts`

## Available Skills

Two skills are installed via `skills-lock.json`:

- **spec** - Use when creating or updating feature specifications, requirements docs, or design documents
- **spec-impl** - Use when implementing features based on specifications (transforms specs into code)

Invoke these skills when tasks match their descriptions. The skill instructions will appear automatically when needed.
