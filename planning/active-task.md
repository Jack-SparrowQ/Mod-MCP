# Active task — Phase 6a: release hardening (code)

Status: **delegated to Codex** — 2026-11-16. (Phase 6b — Codex MCP client test and final review —
is done by Claude afterwards.)

## Changes

1. **Partial-write message** (`src/application/submit-assignment.ts`): when `saveSubmission`
   succeeded but a later step fails (`submitForGrading` throws, or the verification status is not
   `submitted`), the returned error must say so. Keep the original error code; set `message` to
   "Files were saved in Moodle as a draft but the submission was not confirmed." and add
   `context.draftSaved = true` (keep existing context such as `status`), suggestion: "Open the
   assignment in Moodle to check it; do not retry blindly." Errors before `saveSubmission`
   succeeds must not carry `draftSaved`. No retries.
2. **`@types/node`**: pin to the Node 24 line (`npm install --save-dev @types/node@^24`), the only
   network access allowed. Fix any type errors this reveals without changing behavior.

## Out of scope

Anything else; real Moodle calls; `.env`; README (Claude updates it); committing.

## Acceptance criteria

- `npm run typecheck`, `npm run build`, `npm test` pass (paste result lines).
- Tests: submit_for_grading failure after save → error with `draftSaved: true` and the message;
  verification `draft` after save → `OPERATION_FAILED` with `draftSaved: true` and `status`;
  upload failure → no `draftSaved`.
- `package.json` / `package-lock.json` show `@types/node` 24.x.
- Report `planning/reports/phase-6a.md` (AGENTS.md format).
