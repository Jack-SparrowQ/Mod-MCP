# Phase 1 — MCP foundation

## 1. Changed files

- `package.json` — REST description, test/token scripts, authorized runtime/dev dependencies.
- `package-lock.json` — resolved dependency versions for reproducible installation.
- `.env.example` — token-only server configuration and note about the old probe's username/password variables.
- `src/index.ts` — optional native env-file loading, composition root, stdio connection, generic stderr startup failure.
- `src/shared/config.ts` — Zod configuration validation, HTTPS URL restrictions and safe diagnostics.
- `src/domain/errors.ts` — all requirements §12 codes and standard context/recovery errors.
- `src/domain/moodle-adapter.ts` — minimal adapter interface and four-field site model.
- `src/infrastructure/logging/logger.ts` — Pino stderr destination and token/password field redaction.
- `src/infrastructure/moodle/rest-client.ts` — allow-listed POST calls, timeout, safe error mapping and call timing.
- `src/infrastructure/moodle/rest-adapter.ts` — site-info validation and strict field selection/token redaction.
- `src/application/auth-status.ts` — status use case and normal versus failed result mapping.
- `src/mcp/server.ts` — server construction with injected domain adapter.
- `src/mcp/tools/auth-status.ts` — strict empty input, read-only annotations, JSON text and structured result.
- `scripts/get-token.mjs` — interactive credential exchange and token-only env-file update; exported pure helper.
- `vitest.config.ts` — unit/integration runner configuration and global network guard setup.
- `tests/setup.ts` — throwing default fetch stub in every test; restored after each test.
- `tests/unit/config.test.ts` — defaults and unsafe URL validation coverage.
- `tests/unit/rest-client.test.ts` — request shape, no-call guards, error mappings, secret-safe errors/logs and adapter field selection.
- `tests/unit/get-token.test.ts` — pure env-line insertion/replacement/preservation/injection checks.
- `tests/integration/mcp.test.ts` — real SDK server/client with paired in-memory transports, five status scenarios and invalid-input rejection.
- `planning/reports/phase-1.md` — this report.

No docs, AGENTS.md, CLAUDE.md, planning inputs, or probe scripts were edited.
`planning/active-task.md`, `planning/backlog.md`, and the untracked ADR 0003 existed
as changes before this work and were preserved. No commit was made.

## 2. Verification

### Authorized dependency installation

PowerShell blocks `npm.ps1`, so executable invocations use `npm.cmd`.
The initial `npm install ...` attempt failed before installation with:

```text
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```

Command:

```powershell
npm.cmd install @modelcontextprotocol/sdk@latest zod@latest pino@latest; if ($LASTEXITCODE -eq 0) { npm.cmd install --save-dev typescript@latest tsx@latest vitest@latest @types/node@latest }
```

The sandbox attempt exited 1 with registry access `EACCES`; it was rerun using
network escalation, which exited 0. Successful installation output:

```text
added 108 packages, and audited 109 packages in 16s

37 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

added 42 packages, and audited 151 packages in 29s

49 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
npm warn allow-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn allow-scripts   esbuild@0.28.2 (postinstall: node install.js)+npm warn allow-scripts
npm warn allow-scripts Run `npm approve-scripts --allow-scripts-pending` to review, or `npm approve-scripts <pkg>` to allow.
```

The elevated shell also reported its pre-existing PSReadLine profile warning:
`Set-PSReadLineOption ... The handle is invalid.` Installation still succeeded.
No separate script approval command or additional network command was run.

Locked direct versions and one-line dependency justifications:

- `@modelcontextprotocol/sdk` 1.32.2 — official stdio server, client and in-memory transport.
- `zod` 4.6.7 — environment and tool-input validation supported by the installed SDK.
- `pino` 10.4.0 — structured stderr logging and secret-field redaction.
- `typescript` 7.0.2 — strict ESM compilation/type checking.
- `tsx` 4.23.15 — requested TypeScript development runner.
- `vitest` 5.1.0 — mocked unit and SDK integration tests.
- `@types/node` 26.6.6 — latest stable Node types as requested; executed APIs remain compatible with Node 24.

### Type checking, build and tests

An initial typecheck passed. Initial tests found one failure:

```text
Test Files  1 failed | 3 passed (4)
     Tests  1 failed | 36 passed (37)
```

The failure showed that Zod still evaluates the URL refinement for invalid URL
text; the refinement's `new URL()` threw instead of returning false. A catch in
the refinement now makes this a normal validation failure with the safe message.

Final exact command:

```powershell
npm.cmd run typecheck; if ($LASTEXITCODE -eq 0) { npm.cmd run build }; if ($LASTEXITCODE -eq 0) { npm.cmd test }
```

Exit 0. Output:

```text
> moodle-itescam-mcp@0.1.0 typecheck
> tsc --noEmit

> moodle-itescam-mcp@0.1.0 build
> tsc

> moodle-itescam-mcp@0.1.0 test
> vitest run

 RUN  v5.1.0 C:/Users/Carlo/Projects/mod-mcp

 Test Files  4 passed (4)
      Tests  37 passed (37)
   Start at  13:33:37
   Duration  793ms (import 54%, transform 20%, tests 15%, setup 8%, worker 3%)
```

Tests use only fake values and mock fetch. Timeout coverage waits for the actual
AbortSignal on an injected mock promise; it does not contact a host. SDK tests
exercise tool listing, success, AUTH_REQUIRED, SESSION_EXPIRED, PERMISSION_DENIED,
unexpected adapter failures, output privacy and rejected extra input fields.

### Built stdio smoke check

The following inline Node module was piped through `node --input-type=module`
using a PowerShell single-quoted here-string. It starts the actual built entry
with an open stdin pipe, no protocol messages, an isolated empty temporary cwd,
and no credentials. The child is terminated after measurement.

```javascript
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const cwd = await mkdtemp(join(tmpdir(), 'moodle-mcp-smoke-'));
const entry = resolve('dist/index.js');
const env = {...process.env};
delete env.MOODLE_TOKEN;
delete env.MOODLE_USERNAME;
delete env.MOODLE_PASSWORD;
env.MOODLE_BASE_URL = 'https://example.invalid/moodle/';
env.LOG_LEVEL = 'info';
const child = spawn(process.execPath, [entry], {cwd, env, stdio: ['pipe', 'pipe', 'pipe']});
let stdout = '';
let stderr = '';
child.stdout.on('data', data => { stdout += data; });
child.stderr.on('data', data => { stderr += data; });
const closed = new Promise(resolve => child.once('close', resolve));
try {
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.equal(child.exitCode, null);
  assert.equal(stdout, '');
  assert.equal(stderr, '');
  console.log('SMOKE PASS: node dist/index.js stayed alive for 1500 ms with stdin open; stdout=0 bytes; stderr=0 bytes; no token; isolated empty cwd; no protocol input.');
} finally {
  child.kill();
  await closed;
  await rm(cwd, {recursive: true});
}
```

Exit 0. Output:

```text
SMOKE PASS: node dist/index.js stayed alive for 1500 ms with stdin open; stdout=0 bytes; stderr=0 bytes; no token; isolated empty cwd; no protocol input.
```

`node --check scripts/get-token.mjs` exited 0 with empty output.
`git diff --check` exited 0 with no whitespace errors; it warned about LF/CRLF
conversion in `.env.example`, `package.json` and pre-existing modified planning
files. `git status --short` also warned it could not read the global Git ignore
file, then reported (before this report was created):

```text
 M .env.example
 M package.json
 M planning/active-task.md
 M planning/backlog.md
?? docs/decisions/0003-token-only-credentials.md
?? package-lock.json
?? scripts/get-token.mjs
?? src/
?? tests/
?? vitest.config.ts
```

## 3. Explanation

The composition root loads `.env` if present using Node, validates configuration,
constructs the REST client and adapter, injects the adapter into the MCP server,
and connects stdio. It makes no startup Moodle calls. The MCP/application layers
depend on the domain interface and do not import infrastructure.

`moodle_auth_status` takes an empty strict object. It requests site information
through the use case and returns only the four site fields. Missing/expired token
is a normal result with `authenticated:false` and `Run npm run token`. Other
errors set `isError:true` and include standard code, safe message, context and
suggestion. Both JSON text and structured content contain the same object.

The REST client permits only `core_webservice_get_site_info`, validates that a
token exists, and sends secrets only in a form POST body. Reserved protocol fields
cannot be overridden by params. Redirects fail; default timeout is 15 seconds
and can be overridden through the client constructor. Each call logs one safe
function/duration/outcome record; no parameters, raw exceptions, URLs or Moodle
messages are logged. Token echoes in site metadata and error codes are redacted.

Error mappings cover invalidtoken → SESSION_EXPIRED; accessexception,
nopermissions and requireloginerror → PERMISSION_DENIED; servicenotavailable,
webservicesnotenabled and webserviceisdisabled → INTEGRATION_UNSUPPORTED. Other
Moodle errors retain only their sanitized identifier in context. Network errors,
timeouts, server errors and invalid JSON become MOODLE_UNAVAILABLE. Other HTTP
failures become OPERATION_FAILED with only the numeric HTTP status. No cause
chain containing a raw fetch error is retained.

The token CLI refuses non-TTY input. Username is visible, while password input
uses raw mode with no character echo, handling enter, backspace and cancellation.
It exchanges credentials in a POST body, writes only the returned alphanumeric
token into `.env`, preserves unrelated lines, and emits confirmation to stderr.
It never persists username/password or prints token/private-token values. Pure
helper tests cover replacement, append, duplicate cleanup and newline rejection.
No CLI invocation or credential exchange was performed during this task.

Native env loading follows ADR 0003; dotenv and Playwright were not installed.
The single-tool allow-list and adapter boundary keep later features from
accidentally reaching unverified functions. No caching or retry policy was added.

### Commands for Claude to document in AGENTS.md

AGENTS.md was intentionally not edited. The package scripts now are:

```text
npm run typecheck  -> tsc --noEmit
npm run build      -> tsc
npm test           -> vitest run
npm run dev        -> tsx src/index.ts
npm start          -> node dist/index.js
npm run token      -> node scripts/get-token.mjs
```

The changes are the addition of `test` and `token`; `start` already existed but
was absent from the AGENTS.md command list. Windows PowerShell may require
`npm.cmd` in place of `npm` because of local execution policy.

### Claude Code registration snippet (not executed)

After the user obtains a token locally with `npm run token` from this repository
and builds the server, register it with absolute paths so env loading does not
depend on Claude Code's working directory:

```powershell
claude mcp add --transport stdio moodle-itescam -- node --env-file=C:/Users/Carlo/Projects/mod-mcp/.env C:/Users/Carlo/Projects/mod-mcp/dist/index.js
```

No credentials appear in the command. Registration and real tool calls are left
to the user; neither was executed.

## 4. Open issues

- No real Moodle requests were sent, no `.env` was created, and no real credentials were used. Live auth status and interactive token exchange remain unverified in this task.
- Password no-echo behavior is implemented through Node TTY raw mode but was not exercised interactively with credentials; helper logic is tested offline.
- Array/nested Moodle parameter flattening is deferred; the sole allowed function needs no such arguments.
- Disabled-service identifier aliases are covered by local fixtures, not a live disabled server. Additional future Moodle codes should be added only with evidence.
- The default logging level can suppress info timing records if the user selects a higher threshold or silent. Logged records never include params or raw exception bodies.
- `.env` creation requests mode 0600; Windows ACLs and permissions on pre-existing files remain the user's responsibility. No secret file was touched here.
- npm reported an esbuild postinstall approval warning; current build and all tests nevertheless pass. The `dev` runner was not separately smoke-tested.
- Only `src` is included in the existing production TypeScript configuration; tests are executed by Vitest.

## Review fixes

### Changed files

- `src/index.ts` — resolve `.env` with `fileURLToPath(new URL('../.env', import.meta.url))`, independent of the process working directory. Both `src/index.ts` and `dist/index.js` resolve to the project-root file. Missing files still pass through the existing ENOENT exception; other loading failures retain the same generic diagnostic.
- `tests/unit/env-location.test.ts` — two offline regression cases for source and built directory layouts, using the entry's actual loading expression in temporary modules and Node's native loader.
- `planning/reports/phase-1.md` — append this review response, verification evidence and replacement registration command.

### Verification

Node's `process.loadEnvFile(path)` populates unset environment variables and does
not overwrite variables already in `process.env`. This was checked directly using
the installed Node runtime in both new tests: the temporary project-root file
sets `PHASE1_REVIEW_VALUE=from-project`, a conflicting cwd file sets it to
`from-cwd`, and the child receives `PHASE1_REVIEW_EXISTING=from-environment`
while the root file specifies `from-file`. Both cases assert the result is
`{value: 'from-project', existing: 'from-environment'}`. Only temporary fixture
`.env` files containing these non-secret test values are created and removed;
the repository `.env` is never created, read by the test, or modified. No token,
credentials or network requests are involved.

Exact command:

```powershell
npm.cmd run typecheck; if ($LASTEXITCODE -eq 0) { npm.cmd run build }; if ($LASTEXITCODE -eq 0) { npm.cmd test }
```

Exit 0. Output:

```text
> moodle-itescam-mcp@0.1.0 typecheck
> tsc --noEmit

> moodle-itescam-mcp@0.1.0 build
> tsc

> moodle-itescam-mcp@0.1.0 test
> vitest run

 RUN  v5.1.0 C:/Users/Carlo/Projects/mod-mcp

 Test Files  5 passed (5)
      Tests  39 passed (39)
   Start at  13:38:41
   Duration  705ms (import 41%, tests 33%, transform 17%, setup 6%, worker 3%)
```

### Updated Claude Code registration (replaces the earlier snippet)

The entry now locates the project-root `.env` itself, so no `--env-file` is needed:

```powershell
claude mcp add --transport stdio moodle-itescam -- node C:/Users/Carlo/Projects/mod-mcp/dist/index.js
```

This command was not executed. No network access or commit was performed. No
remaining issue for this review fix; real-site execution remains outside scope.
