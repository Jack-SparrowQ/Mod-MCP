# Phase 6b — final-review fixes

## 1. Changed files

- `src/shared/path-containment.ts` — platform-aware equality/containment comparisons for canonical paths; case-insensitive only on Windows.
- `src/infrastructure/moodle/file-download.ts` — canonical download-root containment, connect/header plus resettable inactivity deadlines, cancellation-safe reads and cleanup.
- `src/infrastructure/moodle/rest-client.ts` — pass the configured download root into the download infrastructure.
- `src/infrastructure/moodle/rest-adapter.ts` — supply that root with the selected file download.
- `src/infrastructure/files/submission-files.ts` — canonical root/file comparisons, retain link refusal, reject PARAM_FILE-altered basenames with a rename suggestion.
- `src/shared/submission-status.ts` — single shared first-attempt and team-status normalization.
- `src/infrastructure/moodle/academic-reads.ts` — use that normalizer for assignment-detail status and modification time.
- `src/infrastructure/moodle/submission-adapter.ts` — use the same normalizer and read extensionduedate/team status.
- `src/domain/submission.ts` — internal extension due date and explicit confirmation-timeout cancellation reason.
- `src/application/submit-assignment.ts` — trust authoritative Moodle edit/submit flags for date overrides, use effective extended due date, propagate timeout cancellation.
- `src/mcp/tools/submit-assignment.ts` — ten-minute elicitation timeout; distinguish timeout from capability/protocol failure.
- `src/infrastructure/moodle/academic-schemas.ts` — accept nullish/absent optional grade values without accepting unexpected non-null types.
- `tests/unit/final-review.test.ts` — regressions for canonical path casing/escape refusal, shared status, team overdue behavior, optional grades and active/stalled downloads.
- `tests/integration/submit-assignment.test.ts` — first submission, filename characters, overrides/extensions, elicitation timeout and protocol failure; retain local date checks when canedit is absent.
- `tests/unit/live-review.test.ts` — update old mandatory-grade-field assumptions; keep rejecting wrong non-null value types.
- `planning/reports/phase-6b.md` — this report.

The active-task file was already modified on entry and was left untouched. No
README, docs, package/dependency files or env file was edited. No network command,
real Moodle request, dependency install, staging or commit was performed.

## 2. Verification

All HTTP is mock fetch; client/server tool tests use SDK in-memory transport.
Filesystem tests write only under checked temporary roots, never real downloads/
or submissions/. The unchanged Phase 1 env-loader tests retain isolated temporary
fixtures with non-secret values; no repository `.env` was created or used.

An intermediate typecheck identified the timer initialization typing:

```text
src/infrastructure/moodle/file-download.ts(123,20): error TS2454: Variable 'timer' is used before being assigned.
src/infrastructure/moodle/file-download.ts(146,18): error TS2454: Variable 'timer' is used before being assigned.
```

The timer handle is now explicitly optional, which matches the clear/reset
lifecycle. The first complete run after that correction passed; the final run
also passed after the added regression assertions and abort cleanup hardening.

Final exact command:

```powershell
npm.cmd run typecheck; if ($LASTEXITCODE -eq 0) { npm.cmd run build }; if ($LASTEXITCODE -eq 0) { npm.cmd test }
```

Exit code **0**. Output (the command yielded while Vitest ran; completion was
collected from the same session):

```text
> moodle-itescam-mcp@0.1.0 typecheck
> tsc --noEmit

> moodle-itescam-mcp@0.1.0 build
> tsc

> moodle-itescam-mcp@0.1.0 test
> vitest run

 RUN  v5.1.0 C:/Users/Carlo/Projects/mod-mcp

 Test Files  18 passed (18)
      Tests  324 passed (324)
   Start at  15:57:10
   Duration  3.71s (import 43%, tests 38%, transform 14%, setup 4%, worker 1%)
```

Regression evidence for each review finding:

1. **Windows downloads casing:** the configured root/destination use lowercase
   spellings of a real MiXeDDownloads directory; bytes are successfully saved
   and read from the canonical path. This Windows-only test ran on this host;
   on other platforms its explicit Windows-only skip condition applies.
2. **Windows submissions casing:** a lowercase injected MiXeDSubmissions root
   supports both inspection and the hash/size recheck. This Windows-only test
   also ran. A new download-junction escape test and the existing submission
   junction test still reject escaping paths.
3. **PARAM_FILE names:** apostrophe, ampersand, backtick and a control-character
   basename all return VALIDATION_ERROR with reason=filename_characters and a
   rename suggestion before any HTTP call/confirmation. Existing illegal-path
   and NTFS-stream cases remain rejected.
4. **Optional grade values:** one case omits every newly optional value; another
   supplies null for all of them. Public grade/raw/min/max/percentage/feedback/
   date values are null and graded=false. Incorrect non-null types and other-user
   responses remain rejected. gradeishidden retains its existing schema-only
   role; no extra public output field was introduced.
5. **Download inactivity:** four chunks arrive within each inactivity interval,
   and the download succeeds even though total duration exceeds one interval.
   A stalled body times out, is cancelled and leaves no partial file. Existing
   connect timeout/error and overflow cleanup tests remain passing.
6. **First submission:** a present lastattempt without submission normalizes to
   new in both adapters and reaches a verified submitted result in the SDK flow.
   Missing/malformed attempts normalize to unknown in the shared helper; existing
   response schemas continue to reject invalid field types safely.
7. **Overrides/extensions:** canedit=true/cansubmit=true allows an assignment
   despite contradictory assignment-wide opening/cutoff dates. A later
   extensionduedate appears in the dialog, removes LATE and yields late=false.
   The existing not-open/cutoff cases now omit canedit to verify fallback local
   checks; explicit false edit/submit permissions still refuse writes.
8. **Team status:** individual=new plus team=submitted reports submitted with
   the team's modification time through both readers. Assignment detail for a
   past-due task then reports overdue=false.
9. **Elicitation timeout:** a request-boundary spy verifies timeout=600000 and
   simulates SDK RequestTimeout. The MCP tool returns isError=false with exactly
   `{submitted:false,cancelled:true,reason:'confirmation_timeout'}` and zero writes.
   A separate protocol-error case still returns CONFIRMATION_REQUIRED and zero
   writes. Existing real in-memory form tests continue to exercise approvals,
   declines, invalid boolean replies and required statements.

Final review command:

```powershell
git diff --check; Write-Output "DIFF_CHECK_EXIT=$LASTEXITCODE"
git status --short
rg -n 'normalizeSubmissionStatus|extensionDueDate|timeout: ELICITATION|gradeishidden' src
```

Whitespace output:

```text
warning: in the working copy of 'planning/active-task.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/application/submit-assignment.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/domain/submission.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/files/submission-files.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/academic-reads.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/academic-schemas.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/file-download.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/rest-adapter.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/rest-client.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/submission-adapter.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/mcp/tools/submit-assignment.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/integration/submit-assignment.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/unit/live-review.test.ts', LF will be replaced by CRLF the next time Git touches it
DIFF_CHECK_EXIT=0
```

Status showed only the listed implementation/tests plus the pre-existing
active-task change before this report was created. Git warned that its global
ignore file was unreadable. Source search confirmed one normalization definition
used by both readers and the explicit elicitation timeout.

## 3. Explanation

Filesystem comparisons now canonicalize the trusted root and destination/file
with realpath before containment checks. Windows comparisons fold case; other
platforms keep case sensitivity. Downloads receive the configured downloads root
as a containment boundary, so a course-directory junction outside it cannot be
made safe merely by canonicalizing the junction target. Submissions still walk
components with lstat and refuse links, then compare canonical file/root paths.

The shared submission normalizer treats an existing empty attempt as new,
distinguishes missing attempts from first attempts, and selects team state when
the individual state is absent/new. Both public assignment detail and submission
preflight/verification use that function, including the selected modification
timestamp.

Moodle's explicit edit permission now overrides coarse assignment-wide date
checks, provided finalization is not explicitly disallowed for a draft-enabled
assignment. Without that affirmative flag, local opening/cutoff checks remain in
place and are repeated after confirmation and file snapshots. An extension later
than the base due date supplies the effective confirmation and late-output date.
Other policy restrictions and the already-submitted/team-write refusals remain.

Confirmation requests allow ten minutes. A request timeout is cancellation, not
evidence the client lacks form support; it never reaches upload. Capability and
protocol failures retain the existing recovery error. Download headers have their
own timeout; each body chunk resets the inactivity deadline, and body completion
stops it. Aborted reads are cancelled/cleaned without exposing raw errors.

Grade optionality now follows the final review's broader response contract while
preserving strict itemtype and own-user checks. Missing mapped values stay null;
non-null values retain the previous type validation.

## 4. Open issues

No known remaining issue within these requested fixes. Wider de-duplication from
finding 10 stays out of scope. Actual Moodle/client UI behavior remains for
Claude's authorized live check; no live submission/download was performed.
The ten-minute timeout was verified at the SDK request boundary without waiting
ten wall-clock minutes; individual MCP clients can impose their own shorter tool
timeouts. No network, `.env`, README edits, dependencies or commits were involved.
