# Phase 6a — release hardening

## 1. Changed files

- `src/application/submit-assignment.ts` — mark save completion and annotate later failures with the required partial-write message, preserved code/context, draftSaved=true and recovery suggestion.
- `src/domain/errors.ts` — allow boolean context values so draftSaved is a JSON boolean.
- `tests/integration/submit-assignment.test.ts` — verify finalization/status/transport failures after save and absence of draftSaved for upload or save failures.
- `package.json` — @types/node now targets ^24.19.2.
- `package-lock.json` — lock @types/node 24.19.2 and its undici-types 7.24.6 dependency; npm also synchronized the already-existing Node >=24 engine metadata into the root lock entry.
- `planning/reports/phase-6a.md` — this report.

The active-task file was already modified on entry and was not edited. No README,
env file, other feature, commit or branch change was made. No command changes.

## 2. Verification

Only the authorized single-dependency npm install used network access. There were
no Moodle requests or real credentials. Tests use mocked fetch and temporary
files; no repository `.env`, submissions/ or downloads/ was created or used.

Command:

```powershell
npm.cmd install --save-dev '@types/node@^24'
```

The sandbox attempt exited 1 after dependency-resolution warnings, with:

```text
npm error code EACCES
npm error errno EACCES
npm error FetchError: request to https://registry.npmjs.org/@types%2fnode failed, reason:
```

The same command was rerun with network escalation and exited 0. Output:

```text
changed 2 packages, and audited 151 packages in 1s

49 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
npm warn allow-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn allow-scripts   esbuild@0.28.2 (install: (install scripts present))
npm warn allow-scripts
npm warn allow-scripts Run `npm approve-scripts --allow-scripts-pending` to review, or `npm approve-scripts <pkg>` to allow.
```

The elevated shell also emitted its existing PSReadLine profile warning,
`Set-PSReadLineOption ... The handle is invalid.` No separate approval/install
script command was run.

Final exact verification command:

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
      Tests  309 passed (309)
   Start at  15:42:38
   Duration  2.26s (import 35%, transform 35%, tests 25%, setup 4%, worker 1%)
```

The tests assert:

- Failed finalize after successful save preserves OPERATION_FAILED and warningcodes, with draftSaved=true and the exact required message/suggestion.
- A different finalize error preserves PERMISSION_DENIED and its original errorcode context.
- Verification returning draft preserves OPERATION_FAILED and status=draft, adding draftSaved=true.
- Verification transport failure preserves MOODLE_UNAVAILABLE and adds draftSaved=true, with exactly two status attempts total (preflight and verification), no retry.
- Upload and save failures have no draftSaved field. Existing no-retry assertions remain passing.

Reviewed `git diff -- package.json package-lock.json`, which showed:

```text
@types/node: ^26.6.6 -> ^24.19.2
node_modules/@types/node version: 26.6.6 -> 24.19.2
node_modules/undici-types version: 8.9.0 -> 7.24.6
```

Command: `git diff --check; Write-Output "DIFF_CHECK_EXIT=$LASTEXITCODE"`

Output:

```text
warning: in the working copy of 'package-lock.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'planning/active-task.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/application/submit-assignment.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/domain/errors.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/integration/submit-assignment.test.ts', LF will be replaced by CRLF the next time Git touches it
DIFF_CHECK_EXIT=0
```

`git status --short` showed only those five implementation/dependency/test files
plus the pre-existing active-task change before this report was created. Git
warned its global ignore file was unreadable.

## 3. Explanation

A local flag starts false and becomes true only after saveSubmission resolves.
The workflow's catch leaves earlier failures unchanged. For any later failure,
it keeps the original MoodleError code/context (or safely normalizes an unexpected
error), then adds the required message and boolean draftSaved flag:

```text
Files were saved in Moodle as a draft but the submission was not confirmed.
```

The recovery suggestion is exactly:

```text
Open the assignment in Moodle to check it; do not retry blindly.
```

The lock still releases in finally and no request is retried. This makes a partial
remote write visible without claiming successful submission. Node 24 types now
match the supported runtime line; no additional type fixes were necessary.

Dependency justification: @types/node was constrained to the supported Node 24
runtime API surface; no new direct dependency was added.

## 4. Open issues

None for the requested code changes. Actual Moodle writes remain untested and
Phase 6b client verification belongs to Claude. A save request that fails or
times out before returning success intentionally has no draftSaved claim because
the server has not confirmed that step; users still must inspect Moodle before
retrying an ambiguous write. No README edits or commits were performed.
