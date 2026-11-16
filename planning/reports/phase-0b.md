# Phase 0b — authenticated probe, script only

## 1. Changed files

- `scripts/probe-auth.mjs` — dependency-free Node 24 probe, exported pure summary function, and offline self-test.
- `.env.example` — exactly the three requested configuration variables, with placeholder values only.
- `planning/reports/phase-0b.md` — implementation explanation and captured local verification output.

## 2. Verification

Only the three authorized local verifications were executed. No network requests
were made, no `.env` was created, and no real credentials were used.

Command: `node scripts/probe-auth.mjs --self-test`

Exit code: **0**. Output:

```text
SELF-TEST PASS: summary allow-list, secret/email exclusion, required functions, two POST bodies, missing-env no-request, sanitized failures; no network.
```

The self-test replaces global fetch with a throwing guard, uses injected in-memory
responses, and checks that the successful flow makes exactly two simulated POSTs.
It asserts the exact form-body parameters, absence of query parameters, redirect
rejection, sorted/deduplicated functions, all 12 required-function booleans, exact
output keys, exclusion of fixture secrets and identity fields, email redaction,
missing-env zero calls, token-error stop after one call, and generic transport
errors that do not echo the original exception.

Command (PowerShell; clear variables in this child shell to guarantee the missing-env case without inspecting their values):

```powershell
$env:MOODLE_USERNAME = $null; $env:MOODLE_PASSWORD = $null; node scripts/probe-auth.mjs
```

Exit code: **1**, as required. Output:

```text
Missing required environment variables: MOODLE_USERNAME and MOODLE_PASSWORD.
```

Code inspection confirms that credential validation occurs before URL construction
or fetch. The self-test separately asserts zero calls with missing variables.

Command: `node --check scripts/probe-auth.mjs`

Exit code: **0**. Output: empty (syntax check passed).

No dependencies were added. No real-site verification, integration tests, or
additional verification commands were run. Nothing was committed.

## 3. Explanation

Normal execution reads the three environment variables and defaults the base URL
to the specified ITESCAM Moodle URL. Missing credentials stop execution immediately.
The base must use HTTPS and cannot contain credentials, a query, or a fragment.
The script submits username, password, and `service=moodle_mobile_app` in a
URL-encoded POST body to `login/token.php`. The returned token stays in memory.
It then submits that token, `core_webservice_get_site_info`, and JSON response
format in a POST body to `webservice/rest/server.php`. There are no retries,
redirect following, other function calls, or file writes. Errors stop the flow;
a successful flow makes exactly two requests.

Both responses are checked for HTTP/JSON failures and Moodle application errors.
For a Moodle error, only a syntactically valid error code is printed; messages,
response bodies, and transport exception details are excluded. Malformed error
codes become `unknownerror`. Generic local failure messages contain no response
data. Each request has a 20-second timeout.

The pure `summarize(siteInfo)` function copies only the eight specified scalar
metadata fields and constructs `functionCount`, sorted unique `functions`, and
the 12 `requiredFunctions` booleans. Missing or non-scalar metadata becomes null;
email-like text in metadata is redacted. Function names must have the expected
lowercase external-function identifier shape. Identity fields, arbitrary nested
data, token fields, and private-token fields are never copied. Using an allow-list
avoids relying on deleting a finite set of sensitive fields from a full response.

The fixture uses only fake credentials and personal-data sentinels. Mock requests
verify the execution flow without contacting any host. A real invocation is left
for the user: `node --env-file=.env scripts/probe-auth.mjs`. Requesting a token may
create or reuse a Moodle mobile-service security key, as described in the task.

## 4. Open issues

- Real token issuance, authentication restrictions, granted functions, and site metadata remain unverified; only the user may perform the authorized real run.
- `functionCount` counts unique valid function names. Standard Moodle output is expected to contain valid unique names; malformed entries are omitted.
- The metadata email filter is a defensive text filter, not a full personal-data classifier; the site name is intentionally retained because the specification requires it.
- `.env.example` deliberately uses a non-routable example host; the user must replace placeholders locally before a real invocation. No `.env` was created.
- `docs/moodle-investigation.md` and all out-of-scope files were left unchanged. The only planning file created was this explicitly requested report.
