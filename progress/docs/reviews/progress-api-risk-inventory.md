# progress API risk inventory

Generated for auto-review P0-1 remediation on 2026-07-07.

## Boundary applied now

- `npm run dev` and `npm start` bind Next.js to `127.0.0.1:3010`.
- PM2 process `progress` uses `npm start`, so a restart applies the localhost bind.
- This is a network boundary only. It does not replace application-level authentication.

## Dangerous unauthenticated API groups

These routes mutate state, start executors, or can grow/write JSON stores. They must receive token/session protection in the next security epic before any external exposure is considered.

- `POST /api/operations/factory-run`: starts the factory runner and can trigger AI executors when `confirm:true`.
- `POST /api/operations/auto-resume`: resumes automation work.
- `POST /api/operations/ai-review`: changes run review states and can create follow-up work.
- `POST /api/auto-queue/control`: changes queue control, priority, hold/exclude, and completion state.
- `POST /api/auto-queue/reorder`: changes manual queue order.
- `POST/PATCH /api/execution-runs` and `/api/execution-runs/[runId]`: creates or changes run records, review state, and fix requests.
- `POST/PATCH /api/goals*`: creates, approves, links, syncs, or mutates goals and todos.
- `POST/PATCH /api/operations/epics*`: creates or mutates epics.
- `POST /api/operations/approvals*`: creates or decides approval records.
- `POST/PATCH /api/tasks*`, `/api/queue*`, `/api/recommended-epics*`, `/api/monetization*`, `/api/app-proposals*`: mutate JSON-backed work queues and candidate stores.

## Required next epic

Add application-level protection for dangerous progress APIs:

- Require a server-side token or authenticated session for mutating routes.
- Reject unsafe methods for destructive state changes.
- Add request size limits for large text fields such as `rawReport`.
- Keep `GET` routes read-only.
- Add regression tests for unauthenticated mutation rejection.
