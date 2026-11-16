# Phase 2 — profile, courses and course contents

## 1. Changed files

- `src/domain/moodle-adapter.ts` — own-profile, course, section, activity and file-metadata models; three new adapter methods.
- `src/shared/moodle-values.ts` — HTML-to-text conversion capped at 500 characters and nullable UTC date conversion.
- `src/infrastructure/moodle/form-params.ts` — recursive Moodle form encoding, boolean conversion, invalid-key/cycle guards.
- `src/infrastructure/moodle/response-schemas.ts` — response validation for relied-on fields, with generic safe failures.
- `src/infrastructure/moodle/rest-client.ts` — exactly three additional allowed functions, nested params, list responses and constructed site URLs.
- `src/infrastructure/moodle/rest-adapter.ts` — own-ID resolution/cache, profile lookup, course and section mapping, optional metadata and URL filtering.
- `src/application/get-profile.ts` — own-profile use case.
- `src/application/get-courses.ts` — enrolled-course filtering and shared enrolled-course lookup.
- `src/application/get-course-contents.ts` — enrolment gate before requesting contents.
- `src/application/read-result.ts` — common safe error result for the new read use cases.
- `src/mcp/tools/read-tool.ts` — shared read-only annotations and MCP result serialization.
- `src/mcp/tools/get-profile.ts` — strict empty-input profile tool.
- `src/mcp/tools/get-courses.ts` — strict optional query/courseId course tool.
- `src/mcp/tools/get-course-contents.ts` — strict positive-integer courseId contents tool.
- `src/mcp/server.ts` — register all four tools through the injected domain adapter.
- `tests/fixtures/moodle.ts` — fake Moodle-shaped responses, injected fetch and captured safe logs.
- `tests/unit/form-params.test.ts` — scalar, array, nested, boolean and invalid-parameter encoding tests.
- `tests/unit/moodle-values.test.ts` — HTML/entity/truncation and date/null/error coverage.
- `tests/unit/rest-adapter.test.ts` — own-user enforcement, cache behavior, optional/malformed fields, metadata filtering and permission failures.
- `tests/unit/rest-client.test.ts` — update the semantic-invalid-response expectation to OPERATION_FAILED.
- `tests/integration/academic-tools.test.ts` — real SDK client/server over in-memory transport exercising the new tools with injected mock fetch.
- `tests/integration/mcp.test.ts` — extend the fake adapter and expected registry while retaining auth-status regression coverage.
- `planning/reports/phase-2.md` — this report and assumptions for live verification.

No dependencies, package scripts, docs, AGENTS.md, CLAUDE.md, token/probe scripts,
or planning inputs were changed. `planning/active-task.md` and
`planning/backlog.md` were already modified on entry and were preserved. Generated
`dist/` output remains ignored. Nothing was committed.

## 2. Verification

No network commands or live Moodle requests were made; npm was used only to run
already installed local tools. Every test defaults fetch to a throwing guard;
HTTP tests inject fake responses and SDK communication uses in-memory transports.
No real credentials or repository `.env` were created or used. The unchanged
Phase 1 env-location tests still create/remove their isolated temporary fixture
env files with non-secret values; the new Phase 2 tests create no env files.

Initial standalone `npm.cmd run typecheck` exited 0:

```text
> moodle-itescam-mcp@0.1.0 typecheck
> tsc --noEmit
```

The first complete run passed type checking/build but found a test-table mistake:

```text
Test Files  1 failed | 8 passed (9)
     Tests  3 failed | 103 passed (106)
```

Those three optional-email cases passed raw arrays to `it.each`, which expands
array entries into individual callback arguments. The fixtures now wrap each
response in an object, preserving the intended response array. Two additional
cases cover minimal file metadata and recovery after a failed identity request.

Final exact command:

```powershell
npm.cmd run typecheck; if ($LASTEXITCODE -eq 0) { npm.cmd run build }; if ($LASTEXITCODE -eq 0) { npm.cmd test }
```

Exit code 0. Output:

```text
> moodle-itescam-mcp@0.1.0 typecheck
> tsc --noEmit

> moodle-itescam-mcp@0.1.0 build
> tsc

> moodle-itescam-mcp@0.1.0 test
> vitest run

 RUN  v5.1.0 C:/Users/Carlo/Projects/mod-mcp

 Test Files  9 passed (9)
      Tests  108 passed (108)
   Start at  14:00:01
   Duration  930ms (import 46%, tests 26%, transform 18%, setup 7%, worker 3%)
```

Coverage includes:

- Exact own-user `values[0]` and `userid` POST arguments; site_info called once across profile plus repeated course reads; simultaneous requests share the in-flight identity request.
- Courses and profiles are fetched again rather than cached; a failed identity request is not retained; changing own ID for a fixed token fails safely.
- No returned email on empty lookup, absent email or null email; mismatched-user and malformed data are rejected.
- Flat/array/nested forms, boolean 1/0, cycles and ambiguous bracket keys.
- Common/numeric HTML entities, whitespace, scripts/comments, truncation without splitting surrogate pairs; zero/missing dates become null.
- Course/section/module field mapping, absent metadata and file URL exclusion, including unsafe module URL cases.
- Four registered read-only tools, profile output, accent/case-insensitive fullname and shortname search, single-course selection, combined filters and counts.
- Not enrolled → RESOURCE_NOT_FOUND with zero contents calls; enrolled but denied → PERMISSION_DENIED.
- New-tool AUTH_REQUIRED/SESSION_EXPIRED results have isError:true; auth_status retains its original output and normal auth-error behavior.
- Unknown fields, userid, invalid course IDs and invalid queries are rejected before fetch. Logs contain no params, student/course names, email or token values.

Final whitespace-check command:

```powershell
git diff --check; Write-Output "DIFF_CHECK_EXIT=$LASTEXITCODE"
```

Output:

```text
warning: in the working copy of 'planning/active-task.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'planning/backlog.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/domain/moodle-adapter.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/rest-adapter.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/rest-client.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/mcp/server.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/integration/mcp.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/unit/rest-client.test.ts', LF will be replaced by CRLF the next time Git touches it
DIFF_CHECK_EXIT=0
```

`git status --short` confirmed only the listed source/tests plus the pre-existing
planning changes before this report was written. Git also warned that the global
ignore file was unreadable. A source search confirmed the sole logging call
remains the REST function/duration/outcome record; no new stdout writes exist.

## 3. Explanation

The tools validate their inputs and invoke application use cases through
`MoodleAdapter`. Infrastructure owns Moodle response parsing and conversion;
tools never import the REST client. The registry now exposes auth status plus
profile, courses and course contents.

The adapter resolves the authenticated ID from site_info. That validated numeric
ID is the only user ID passed to email/course endpoints, and only that ID persists
for the process lifetime. Full site-info data is shared only while a request is
in flight. Profiles and enrolled lists are never cached. Repeated profile calls
refresh profile information, while subsequent course calls reuse the own ID.
An email response naming any different user fails without exposing its fields.

Course listing returns only enrolled records. Name search normalizes NFD Unicode,
removes combining marks and folds case. `courseId` selects an enrolled record;
when both filters are present the query additionally filters that record. The
unified `moodle_get_courses` replaces separate proposed `moodle_search_courses`
and `moodle_get_course` tools, reducing tool count while preserving those reads.

Contents first fetches enrolled courses, finds the requested ID and only then
calls core_course_get_contents. Absence in the enrolled list is distinct from a
Moodle permission denial after that gate. The output includes only course
identity, sections, activity pages and selected file metadata. Raw content
records, file URLs, picture URLs, token fields and arbitrary response extras are
never copied to tool results.

Dates use UTC ISO strings; missing/zero dates become null. Optional unknown
visibility becomes null rather than being guessed. HTML summaries become plain
text and are capped at 500 Unicode characters including the ellipsis. File sizes,
MIME types and modification dates become null when missing. Identifiers and
names used by the mapping are validated; malformed fields fail with a generic
OPERATION_FAILED rather than leaking schema diagnostics or raw data.

The REST client now accepts list-shaped successful responses as required by the
new endpoints. Invalid JSON remains MOODLE_UNAVAILABLE; parsed JSON with an
invalid top-level scalar/null shape now becomes OPERATION_FAILED, consistent
with the new malformed-response rule. Existing Moodle error mappings are kept.
Nested params are encoded through bracket notation rather than stringifying
arrays/objects; ambiguous literal bracket keys are rejected. Logs retain the
existing policy with no parameter values or response data.

## 4. Open issues and response-shape assumptions for live verification

All items below are **unverified against live Phase 2 responses**. Function
availability was previously documented, but this implementation used only
synthetic Moodle 4.1-shaped fixtures. Claude should verify:

1. `core_webservice_get_site_info` supplies a positive numeric `userid`, string
   `fullname`, optional string/null `username`, and the existing four site fields.
   Numeric strings for IDs are intentionally rejected. Own ID is stable for a
   fixed process token.
2. `core_user_get_users_by_field(field=id, values[0]=ownID)` returns a bare array
   of zero or one own-user object with numeric `id` and optional string/null
   `email`. Empty arrays omit email. A permission/error response propagates as
   an error instead of silently presenting an incomplete successful profile.
3. `core_enrol_get_users_courses(userid=ownID)` returns a bare array with numeric
   `id`, string `shortname` and string `fullname`. Optional course category is
   read from numeric `category`; no `categoryid` alias is invented.
4. Course `startdate`, `enddate` and `lastaccess` are nonnegative Unix seconds or
   null/absent, not milliseconds or numeric strings. `visible` is boolean or
   0/1. `progress` is a finite number/null. Missing optional fields are omitted
   or null according to the domain model.
5. `core_course_get_contents(courseid=...)` returns a bare section array. Sections
   require numeric `id`, string `name` and a `modules` array; `section` is an
   optional nonnegative numeric section number. A missing modules array is
   considered malformed, not silently replaced with an empty section.
6. Modules have numeric `id`, string `name`, string `modname` and optional string
   `url`. Module URLs are conservatively returned only for HTTPS
   `/mod/<name>/view.php` activity pages without credentials or token/sesskey
   query keys. Other URLs are omitted to prevent direct download links. Verify
   this matches the site's normal activity links.
7. Availability text is taken from `availabilityinfo` when present, otherwise
   string `availability`, and converted to bounded plain text. If the latter is
   a JSON restrictions string, it remains text; no restriction evaluation or
   availability inference is implemented.
8. Module `contents`, when present, is an array. Entries have string `type`;
   only `type=file` entries produce metadata. These require string `filename`
   and may supply numeric `filesize`, string `mimetype` and Unix-seconds
   `timemodified`. Non-file entries are omitted. `contents:null` and malformed
   metadata are treated as invalid rather than guessed.
9. Summaries/availability are HTML strings or null/absent. The small text helper
   handles common/numeric entities, not the complete HTML entity vocabulary or
   every malformed HTML edge case; it is not a browser parser.

No assignments, grades, calendar, forums, downloads, writes or extra caching were
implemented. No package install, network access, live test or commit was made.
