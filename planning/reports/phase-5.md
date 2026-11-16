# Phase 5 — confirmed file submissions

## 1. Changed files

- `.gitignore` — ignore submissions/ without creating the real directory.
- `README.md` — submission tool row, local folder instructions, client confirmation and file-only/no-resubmission/client-support limitations; update obsolete read-only wording.
- `src/domain/submission.ts` — local file, byte snapshot, submission policy/state and confirmation ports.
- `src/domain/moodle-adapter.ts` — submission preflight, upload, save and finalize operations behind the existing adapter interface.
- `src/infrastructure/files/submission-files.ts` — confined regular-file inspection, SHA-256 and verified byte snapshots; no local writes.
- `src/infrastructure/moodle/submission-adapter.ts` — validated assignment configs and owner status reads, without exposing raw Moodle records.
- `src/infrastructure/moodle/upload.ts` — fixed-origin multipart draft upload, itemid validation, 120-second timeout, safe mappings and metrics.
- `src/infrastructure/moodle/write-warnings.ts` — validate write replies and expose only safe warning codes.
- `src/infrastructure/moodle/rest-client.ts` — separate WRITE_FUNCTIONS and explicit write method; plain call remains read-only; upload operation.
- `src/infrastructure/moodle/rest-adapter.ts` — delegate preflight reads, draft uploads and the two specific write operations.
- `src/application/submit-assignment.ts` — locked preflight/confirmation/recheck/write/verification workflow.
- `src/mcp/tools/submit-assignment.ts` — strict input, write annotations and form-mode MCP elicitation through the connected client.
- `src/mcp/server.ts` — register the twelfth tool and accept an injected local-file port.
- `src/index.ts` — inject the project-root submissions/ reader independently of cwd.
- `tests/fixtures/submissions.ts` — synthetic assignment policies/states, fake writes and temporary local files.
- `tests/integration/submit-assignment.test.ts` — SDK elicitation, cancellation, security, policy, ordering, concurrency, mutation and no-retry cases.
- `tests/unit/submission-write.test.ts` — plain-call write rejection, explicit-path restrictions and upload base validation.
- `tests/integration/mcp.test.ts` — extend fake adapter/registry expectations while retaining auth regressions.
- `tests/integration/academic-tools.test.ts` — twelve-tool/write-annotation expectations and extended fake adapter.
- `tests/integration/download-resource.test.ts` — update registry count while retaining download coverage.
- `planning/reports/phase-5.md` — this report and live-check assumptions.

No dependencies, package scripts, environment files or existing scripts changed.
`docs/moodle-investigation.md`, `planning/active-task.md`, `planning/backlog.md`
and the untracked ADR 0005 were already changed on entry and were not edited.
No commit, staging, branch change or network command was performed.

## 2. Verification

All HTTP is injected mock fetch; elicitation is exercised using the actual SDK
client/server over paired in-memory transports, with an elicitation.form
capability and ElicitRequestSchema request handler. Local test files are created
only under checked OS temporary roots, never the real submissions/ or downloads/.
No real credentials or repository `.env` are used. The unchanged Phase 1 tests
continue to use their temporary non-secret env-loader fixtures.

Initial `npm.cmd run typecheck` passed. Complete verification runs passed at 303,
306 and finally 307 tests as additional regression cases were added. There were
no test failures in this phase.

Final exact command:

```powershell
npm.cmd run typecheck; if ($LASTEXITCODE -eq 0) { npm.cmd run build }; if ($LASTEXITCODE -eq 0) { npm.cmd test }
```

Exit code **0**. Output:

```text
> moodle-itescam-mcp@0.1.0 typecheck
> tsc --noEmit

> moodle-itescam-mcp@0.1.0 build
> tsc

> moodle-itescam-mcp@0.1.0 test
> vitest run

 RUN  v5.1.0 C:/Users/Carlo/Projects/mod-mcp

 Test Files  17 passed (17)
      Tests  307 passed (307)
   Start at  15:27:53
   Duration  2.36s (import 46%, tests 34%, transform 14%, setup 4%, worker 2%)
```

Coverage includes:

- Twelve tools and the required destructive/non-idempotent submission annotations.
- No form capability → CONFIRMATION_REQUIRED and zero uploads/save/finalize calls.
- Decline, cancel, confirm=false, missing required statement, acceptStatement=false and a string instead of a boolean → normal cancelled result and zero writes.
- Accepted dialog includes course, task, due date, LATE warning, filenames/sizes, draft replacement count, final-for-grading warning and supplied statement text.
- Exact accepted order: two uploads with itemids 0 then 900, save with files_filemanager=900, submit-for-grading when drafts are on, then status. Output is success only after submitted is observed.
- Drafts off → upload/save/status without submit-for-grading; final status draft → OPERATION_FAILED with no submitted:true.
- Absolute paths, ../ traversal, URL-like names, NTFS alternate-stream syntax, directories, empty files, duplicate paths/basenames and an escaping junction → VALIDATION_ERROR before any HTTP call.
- Not enrolled/unknown assignment, already submitted, cutoff passed, not yet open, max-file count, max-file bytes, explicit extension mismatch, non-editable/non-submittable status, file plugin disabled and teamsubmission → zero writes.
- Changes during the dialog, including equal-size different bytes and a changed second file after the first unchanged file was rechecked, stop before the first upload.
- Concurrent same-assignment call is rejected while the first dialog is pending; only one upload occurs after approval.
- Upload/save/finalize failures stop immediately with exactly one attempted failed write and no subsequent writes/retries. Warning free text is excluded; write warning outcomes are logged as OPERATION_FAILED.
- Plain call refuses both write functions; explicit write cannot call read functions or send userid. Upload refuses HTTP/credential/query-bearing bases without fetch.
- Multipart upload goes only to the configured origin/path; submission/status bodies have no userid. Logs contain no filenames, hashes, URLs or token.
- File-type groups defer extension checks to Moodle, while an explicit .ext-only list is enforced locally; zero maxsubmissionsizebytes means no assignment-specific limit.

Final review commands:

```powershell
git diff --check; Write-Output "DIFF_CHECK_EXIT=$LASTEXITCODE"
git status --short
rg -n '\.write\(|\.upload\(|console\.|logger\.' src
git diff -- .gitignore README.md
```

Whitespace-check output:

```text
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/moodle-investigation.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'planning/active-task.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'planning/backlog.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/domain/moodle-adapter.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/index.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/rest-adapter.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/rest-client.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/mcp/server.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/integration/academic-tools.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/integration/download-resource.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/integration/mcp.test.ts', LF will be replaced by CRLF the next time Git touches it
DIFF_CHECK_EXIT=0
```

Status matched the listed changes plus the independent docs/planning/ADR changes;
Git also warned that its global ignore file was unreadable. The source search
showed only the specific submission-adapter upload/write delegations and safe
infrastructure metrics. README/gitignore diff contains the submission feature
documentation and submissions/ ignore entry. This report was created after that
review capture.

## 3. Explanation

The MCP layer owns client capability detection and form elicitation. Application
code receives a confirmation port, a local-file port and MoodleAdapter; it does
not import MCP or infrastructure. Startup injects LocalSubmissionFiles rooted at
the project location. Embedded createServer callers that omit this dependency
get a safe configuration error if they attempt submission.

Local inspection rejects unsafe paths before any Moodle call. It walks path
components with lstat, checks realpath containment and regular-file identity,
uses no-follow opening where supported, streams SHA-256 and rejects empty files.
Basenames must be distinct too, since Moodle's flat draft file manager could
otherwise replace one uploaded file with another sharing its basename.

Read-only preflight resolves the assignment from enrolled-course assignment
results and validates supported file configuration, dates, limits and owner
status. Team assignments and disabled file plugins are unsupported. Known
uneditable or draft-finalization-disabled statuses are refused. Unknown submission
status also fails closed. Known numeric config limits are enforced; .ext-only
lists are checked case-insensitively, while group names are left to Moodle.

The confirmation is an SDK server-to-client elicitation request, not an input
argument the model can set. The required booleans must be real true values in an
accepted response. SDK invalid-form responses, including a missing required
statement, become cancellation without writes. Other elicitation failures return
CONFIRMATION_REQUIRED. Unsupported clients never reach an upload.

After approval, every file is reopened, revalidated and rehashed. All file bytes
are snapshotted and compared before any upload, preventing a changed later file
from causing partial writes and preventing another read after approval from
silently uploading different bytes. Cutoff is checked again after confirmation
and after snapshots. No local files are created by the production submission
reader.

A process-wide assignment lock spans the entire workflow, including the dialog,
not merely the HTTP writes. Holding it earlier prevents two simultaneously
approved submissions from racing. Finally releases it on success, cancellation
or error. Draft uploads use FormData/Blob with token/filearea/itemid and a fixed
same-origin upload endpoint. The explicit write list contains only save_submission
and submit_for_grading. The ordinary call path rejects them before fetch.

After successful writes, owner status is read again with assignid alone. Only
submitted yields submitted:true. Other observed states produce OPERATION_FAILED;
failed status requests propagate their mapped error and never become success.
submittedAt uses the verified modification timestamp, falling back to local
verification time when absent; late is computed against that returned timestamp.
No write is retried or automatically compensated.

### User-ID acceptance wording

The existing required core_enrol_get_users_courses read takes the cached own
userid, as in Phases 2–4. It cannot perform the verified enrolled-course lookup
without that parameter. I preserved that existing read-only contract: no tool
accepts userid, and no new submission-policy/status/upload/save/finalize request
sends it. The integration test explicitly checks all submission-flow requests
except that one inherited enrolment read. A literal ban on userid in every
request body would conflict with the existing verified enrolment API; this is
the scope interpretation used, not a change to the own-user security rule.

## 4. Open issues and live-check assumptions

No live end-to-end submission was attempted. These assumptions remain
**unverified for an actual write** and require review before a user elects to
submit a real assignment:

1. Assignment metadata includes positive numeric id/cmid, names, boolean/0/1
   submissiondrafts/requiresubmissionstatement/teamsubmission and a configs list.
   Config entries use plugin=file, subtype=assignsubmission, name/value. Values
   are strings or numbers, with enabled=1; optional numeric limits must be
   nonnegative integers. Missing enabled fails closed; absent numeric limits
   remain unknown and are left for Moodle validation.
2. The status response exposes lastattempt.submission.status/timemodified and
   optional canedit/cansubmit booleans or 0/1 values. canSubmit=false while drafts
   are enabled is conservatively refused. Verify whether an empty new submission
   can legitimately report false until files are saved before relaxing this.
3. Existing draft count comes from file plugin fileareas where area equals
   submission_files. When these structures are absent the count is unknown, not
   invented. Supplied submissionstatement is shown as bounded text; otherwise
   the dialog uses a generic authorship statement.
4. Multipart POST to the configured base webservice/upload.php accepts file_1,
   token, filearea=draft and itemid, returning a one-element array with positive
   numeric itemid and the same filename. Further uploads must reuse/return the
   same itemid. Server-side filename rewriting fails rather than silently changing
   the user's approved file identity.
5. save_submission accepts files_filemanager in plugindata; finalize accepts the
   explicit acceptance flag. Replies are an empty warnings array or an object
   with a warnings array. Non-empty warnings are failures with warning codes
   only. Other reply shapes fail closed. No view or other write function is added.
6. With submissiondrafts disabled, saving must produce submitted without a
   separate finalize call; otherwise verification fails. With drafts enabled,
   finalize is required before the same owner status check confirms success.
7. The connected client declares form elicitation and displays the required
   boolean form to the human user. Protocol capability/response behavior was
   tested through the SDK; actual client UI behavior remains a live client check.
8. Files are buffered as verified snapshots before the first upload. The count is
   limited to 20 and known assignment per-file limits are enforced, but a zero
   or missing limit imposes no extra arbitrary global size cap; unusually large
   approved files can require substantial process memory.
9. The lock is in-process, as specified. It cannot prevent another Moodle client
   or process changing the assignment/status while the confirmation is open.
   Moodle remains authoritative for final permissions, dates and duplicate rules.
10. A failure after an upload or save can leave draft data in Moodle. There is no
    rollback/removal/resubmission feature. An ambiguous timeout may have reached
    Moodle; the tool reports failure/unknown success, never retries or claims it
    submitted. The human should inspect Moodle before choosing another attempt.

Only file submissions are implemented. Online text, teams, resubmission/reopen,
removal, real Moodle calls, new dependencies and commits remain out of scope.
The prior one-time commit authorization was not reused.
