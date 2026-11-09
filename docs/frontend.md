# Frontend architecture and conventions

The frontend is React 19, TypeScript, Vite, Ant Design v5, SCSS modules, React Query, Axios, React Hook Form, Yup, and Serializr. Its source is under `frontend/src`.

## Current structure

```text
frontend/src/
  App.tsx                       Providers and route composition
  assets/                       Global SCSS
  constants/                    Query keys, API settings, and user-facing text
  enums/                        UI and job enums
  hooks/                        Repository workspace and job lifecycle hooks
  interceptor/interceptor.ts    Shared Axios instance, retries, and error mapping
  models/                       Serializr request and response models
  routes/                       React routes, route paths, and API paths
  services/repository.service.ts Repository API calls and React Query operations
  shared/
    components/                 Reusable Navbar, Sidebar, Form, Input, Button, etc.
    types/                       Shared frontend data and UI types
    utils/                       General helpers
    validation/                  Yup form schemas
  tests/                        Vitest setup, fixtures, and application tests
  types/                        View and component prop types
  views/
    Home/                       Navbar and Outlet shell
    Repository/                 Repository form, list, workspace, and chat
```

Components use their own folders. Reusable components live in `shared/components`; components used only by a view stay inside that view’s folder (or a local `atoms` folder). A component folder typically contains `index.tsx`, a component-named `.module.scss`, and a colocated test where the component has dedicated coverage.

`Home/index.tsx` renders the shared Navbar and `<Outlet />`. The route table in `routes/index.tsx` renders the dashboard at `/`, the repository library at `/repo`, and an individual repository workspace at `/repo/:repoId`.

## Services and API models

`RepositoryService` groups repository operations. It returns named React Query hooks/options for listing repositories, capacity, jobs, chunk summaries, adding or reindexing repositories, deletion, cancellation, and questions. Query keys are centralized in `constants/QueryKey.ts`; mutations update or invalidate the related caches. Active job status refreshes every three seconds and stops on terminal state or read error. Writes do not retry automatically.

The shared Axios instance is in `interceptor/interceptor.ts`. It sets the API base path and timeout, retries eligible transient GET/HEAD errors with bounded backoff, preserves cancellation, and normalizes API/network/timeout errors. Query functions currently do not pass React Query’s AbortSignal to Axios. Request and response models use Serializr aliases to map frontend camelCase fields to the backend snake_case API contract. Yup validates user form input before submission; backend validation remains authoritative.

Only public GitHub repositories are supported. The frontend does not request a GitHub token. Provider and database credentials are backend-only. Do not add credentials to Vite environment variables.

## Components, forms, and style

Use arrow functions for components, hooks, helpers, and handlers. Import groups are package imports, `@src` imports, then SCSS imports, separated by blank lines. Prefer `@src/...` for internal modules. Import SCSS modules as `styles`, use `styles.className`, and use `clsx` to combine classes. Keep JSX handlers named rather than embedding callback functions inline.

The shared `Form` wraps React Hook Form context. `Input`, `Dropdown`, and related fields use that context when given a field name; `FieldError` remains a separate reusable component. Put form schemas under `shared/validation`, reusable constants under `constants`, and status values under `enums`.

## Commands and current verification

From the repository root:

```bash
npm run lint -w frontend
npm run typecheck -w frontend
npm run test -w frontend
npm run build -w frontend
npm run check -w frontend
```

On 10 November 2026, frontend lint, typecheck, and production build passed, but the test suite had 31 failures and 17 passes. The build emits a JavaScript chunk above Vite’s 500 kB advisory threshold. Check [implementation-tracker.md](implementation-tracker.md) for the latest verification record; do not assume frontend checks are fully green until the test failures are resolved.
