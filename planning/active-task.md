# Active task — Phase 5: assignment submission

Status: **delegated to Codex** — 2026-11-16

## Goal

`moodle_submit_assignment` per `docs/decisions/0005-assignment-submission.md` (read first) and
requirements FR-09, §11.2, §11.4, NFR-02. This is the only Moodle **write**. Reuse existing
patterns (adapter, schemas, enrolled checks, `readTool`-style results, path helpers from Phase 4).

## Tool `moodle_submit_assignment`

Input (strict): `assignmentId` int>0, `files`: array (1–20) of file names **relative to
`<project>/submissions/`** (subfolders allowed). No user id, no URLs, no absolute paths.

Annotations: `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`,
`openWorldHint: true`. Description: explains the submissions/ folder, that the user will be asked
to confirm in the client, and that already-submitted assignments are refused.

### Flow (stop at the first failure; every failure before step 5 performs **zero writes**)

1. **Local files** — resolve each name inside `<project>/submissions/` (project root resolved like
   `.env`/downloads); refuse `..`, absolute paths, symlinks/junctions (realpath must stay inside),
   non-regular files, empty files, duplicates → `VALIDATION_ERROR`. Compute size + SHA-256 each.
2. **Assignment checks (reads only)** — assignment must belong to an enrolled course (reuse the
   assignments list; else `RESOURCE_NOT_FOUND`). From `mod_assign_get_assignments` use
   `submissiondrafts`, `requiresubmissionstatement`, `allowsubmissionsfromdate`, `cutoffdate`,
   `duedate` and `configs` (`plugin=file`, `subtype=assignsubmission`: `enabled`,
   `maxfilesubmissions`, `maxsubmissionsizebytes`, `filetypeslist`). From
   `mod_assign_get_submission_status` (assignid only): current status, existing draft file count if
   available, `lastattempt.canedit`/`cansubmit` when present.
   Refuse with `VALIDATION_ERROR` (context says which): file plugin disabled (→ use
   `INTEGRATION_UNSUPPORTED` instead), not open yet, cutoff passed, already `submitted`, `canedit`
   false, too many files, a file over `maxsubmissionsizebytes` (when > 0), extension not in
   `filetypeslist` (only check entries that are `.ext`; if the list contains group names, skip the
   local check and let Moodle validate).
3. **Elicitation** — if the client did not declare the `elicitation` capability →
   `CONFIRMATION_REQUIRED` (suggestion: "Use an MCP client that supports elicitation, such as Claude
   Code"). Otherwise `elicitInput` (form mode) with a message containing: course name, assignment
   name, due date and **LATE** warning if past due, each file name + size, "replaces N existing draft
   files" when applicable, and that it will be submitted for grading (final) when
   `submissiondrafts` is on. Schema: required boolean `confirm`; plus required boolean
   `acceptStatement` when `requiresubmissionstatement` (statement text in the message if available,
   else a generic one). Only `action === 'accept'` with `confirm === true` (and `acceptStatement ===
   true` when required) proceeds. Decline/cancel/false → normal (non-error) result
   `{ submitted: false, cancelled: true }`, zero writes.
4. **Re-check** — recompute SHA-256/size of every file; any change → `VALIDATION_ERROR`, zero writes.
5. **Writes (no retries)** — in-process lock per assignmentId (second concurrent call →
   `VALIDATION_ERROR` "submission already in progress").
   a. Upload each file to the draft area: multipart POST `<base>webservice/upload.php` with `token`,
      `filearea=draft`, `itemid` (0 for the first, then the returned itemid). Same-origin only,
      `redirect: 'error'`, timeout 120 s. Response is a JSON array of `{itemid, filename,…}` or a
      Moodle error object → mapped error.
   b. `mod_assign_save_submission` with `assignmentid` and `plugindata[files_filemanager]=itemid`.
      Non-empty `warnings` → `OPERATION_FAILED` with warning `warningcode`s only (no free text).
   c. If `submissiondrafts` is on: `mod_assign_submit_for_grading` with `assignmentid` and
      `acceptsubmissionstatement` = 1 only when the user accepted it. Warnings as in b.
6. **Verify** — `mod_assign_get_submission_status`; success only if status is `submitted`. Else
   `OPERATION_FAILED` "Moodle did not confirm the submission" (context: observed status). Never
   claim success without this.

Output on success: `{ submitted: true, status, assignmentId, assignmentName, courseName, files:
[{name, size}], submittedAt, late }`.

## REST client

- Add `mod_assign_save_submission`, `mod_assign_submit_for_grading` to a separate
  `WRITE_FUNCTIONS` list. `call()` refuses them unless an explicit write option/method is used
  (`INTEGRATION_UNSUPPORTED`, zero fetch); only the submit use case uses that path.
- `upload(...)` for `webservice/upload.php` (multipart via `FormData`/`Blob`, no new deps).
- Logging: function, duration, outcome, bytes. Never file names, hashes, URLs, token, params.

## Other files

- `.gitignore`: add `submissions/`.
- README: tool row, how to use `submissions/`, the confirmation dialog, limitations (files only,
  no resubmission, requires elicitation-capable client). Claude reviews wording.

## Out of scope

Online-text submissions, resubmission/reopen, removing files, group-submission special handling
(if `teamsubmission` is on, refuse with `INTEGRATION_UNSUPPORTED`), real Moodle calls, `.env`,
new dependencies, committing.

## Acceptance criteria

- `npm run typecheck`, `npm run build`, `npm test` pass (paste result lines).
- Tests (mocked fetch, temp dirs; elicitation through the SDK in-memory client with an
  `elicitation` capability and an `ElicitRequestSchema` handler):
  - client without elicitation → `CONFIRMATION_REQUIRED`, zero writes (no upload, save, submit).
  - decline / cancel / confirm=false / missing acceptStatement when required → cancelled, zero writes.
  - accept → exact call order upload(s) → save → submit_for_grading (only when drafts on) →
    status; `itemid` reused across uploads; success output.
  - verification shows `draft` → `OPERATION_FAILED`, no success claim.
  - path attacks (`../x`, absolute, symlink/junction where the OS allows, directory, empty file,
    duplicates) → `VALIDATION_ERROR`, zero calls.
  - already submitted, cutoff passed, not yet open, too many files, oversize, wrong `.ext`,
    file plugin disabled, team submission → refused, zero writes.
  - file modified between hash and re-check → refused, zero writes.
  - concurrent submission same assignment → second refused.
  - write functions via plain `call()` → refused, zero fetch.
  - no request body ever contains `userid`; upload goes only to the configured origin.
  - tool list has 12 tools.
- Report `planning/reports/phase-5.md` (AGENTS.md format) with assumptions for the live check.
