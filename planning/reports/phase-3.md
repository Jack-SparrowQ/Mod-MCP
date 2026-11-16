# Phase 3 — assignments, deadlines, calendar, grades and announcements

## 1. Changed files

- `src/domain/academic.ts` — normalized academic read models; no raw Moodle records or user-ID inputs.
- `src/domain/moodle-adapter.ts` — extend the adapter with seven academic read operations behind the domain boundary.
- `src/shared/moodle-values.ts` — parameterize the existing text limit; default remains 500 characters.
- `src/shared/activity-url.ts` — extract the existing safe activity-page URL filter for reuse.
- `src/infrastructure/moodle/rest-client.ts` — allow exactly eight additional read functions; explicitly reject userid for submission status and grade overview.
- `src/infrastructure/moodle/academic-schemas.ts` — Zod schemas for the eight endpoint responses, stripping unknown fields and warnings.
- `src/infrastructure/moodle/academic-reads.ts` — validated response mapping, token-owner submission/grade reads and sequential news-forum queries.
- `src/infrastructure/moodle/rest-adapter.ts` — delegate academic reads and reuse the shared URL filter and existing own-user-ID cache.
- `src/application/academic-helpers.ts` — explicit-timezone ISO validation, range checks, selected enrolled courses, due-state logic and common output bound.
- `src/application/get-assignments.ts` — date-filtered, sorted, bounded list without individual submission calls or intro.
- `src/application/get-assignment.ts` — enrolled-assignment lookup followed by own submission/grade detail and overdue computation.
- `src/application/get-upcoming-deadlines.ts` — bounded pending action events with the optional 30-day overdue lookback.
- `src/application/get-calendar-events.ts` — validated date window, enrolled-course gate, event filtering and truncation.
- `src/application/get-grades.ts` — bounded own grade overview or item details plus separate course total.
- `src/application/get-announcements.ts` — news-discussion deduplication, newest-modification ordering and result limit.
- `src/mcp/tools/get-assignments.ts` — strict read-only assignment-list tool.
- `src/mcp/tools/get-assignment.ts` — strict read-only assignment-detail tool.
- `src/mcp/tools/get-upcoming-deadlines.ts` — strict pending-deadlines tool with bounded days/defaults.
- `src/mcp/tools/get-calendar-events.ts` — strict calendar tool with ISO range inputs.
- `src/mcp/tools/get-grades.ts` — strict own-grades tool with optional enrolled course.
- `src/mcp/tools/get-announcements.ts` — strict news-announcements tool with bounded limit/default.
- `src/mcp/server.ts` — register all ten tools.
- `tests/fixtures/academic.ts` — synthetic Moodle 4.1-shaped data and a fixed reference time.
- `tests/integration/phase3-tools.test.ts` — SDK in-memory tests for all six new tools, range/limit/security cases and exact POST bodies.
- `tests/unit/academic-reads.test.ts` — malformed response, own-user, no-write/view, sequencing, sentinel and larger-output cases.
- `tests/integration/academic-tools.test.ts` — update registry expectations and fake adapter to retain Phase 2 regression coverage.
- `tests/integration/mcp.test.ts` — update registry expectations and fake adapter to retain auth-status regression coverage.
- `planning/reports/phase-3.md` — this report and live-verification assumptions.

`planning/active-task.md` and `planning/backlog.md` were already modified on entry
and were left untouched. No docs, AGENTS.md, CLAUDE.md, package files, dependencies,
or scripts were changed. Generated build output remains ignored. No commit was made.

## 2. Verification

There was no network access, npm install, live Moodle call or real credential use.
All new HTTP tests inject fetch; the existing suite retains its default throwing
fetch guard. MCP clients communicate through SDK in-memory transports. No
repository `.env` was created or used. The unchanged Phase 1 env-location tests
still use their isolated temporary fixture files with non-secret test values.

Initial `npm.cmd run typecheck` exited 0:

```text
> moodle-itescam-mcp@0.1.0 typecheck
> tsc --noEmit
```

All complete verification runs passed. The initial new-tool suite passed 145
tests; additional security, shape and bound cases increased coverage to 166.
After the final changes the exact command was:

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

 Test Files  11 passed (11)
      Tests  166 passed (166)
   Start at  14:16:53
   Duration  1.07s (import 45%, tests 29%, transform 18%, setup 5%, worker 2%)
```

The tests prove:

- Ten registered tools, all read-only; all six new tools exercised through the real SDK client/server.
- Sorted assignment list with no intro/status fan-out; dueState is based on dates only; default 50 and maximum 200 entries, with truncation against a 421-assignment fixture.
- No due date → never overdue; submitted past due → not overdue; new/draft/reopened past due → overdue even when cutoff is in the future; unsupported states become unknown.
- Detail instructions are capped at 4000 characters; messages at 2000; ordinary descriptions/feedback at 500.
- Assignment ID outside enrolled-course results never triggers submission-status fetch.
- Non-enrolled courseId fails with RESOURCE_NOT_FOUND before assignment/calendar/grade-item/forum endpoint calls.
- No new tool accepts userid, userId or unknown fields; invalid limits and IDs fail before fetch.
- Submission status POST has assignid and no userid; overview POST has no userid; item-grade POST uses only the site_info own userid.
- The REST client also refuses explicit userid on both prohibited functions, even when it equals the owner ID.
- Invalid ISO dates, timezone-free timestamps, reversed ranges and calendar windows over 92 days return VALIDATION_ERROR before fetch.
- Calendar nested params, site/user/course events, course filtering, dates and the 200-event truncation flag.
- Pending deadlines use the requested timesort window/limit; overdue exclusion and server-overlimit output capping.
- Graded, ungraded, zero and -1-sentinel cases; separate course total; rejection of another user's/course's grade records.
- Only news forums for enrolled courses are queried; discussion requests have sortorder=-1, page=0 and bounded perpage. Instrumented maximum concurrent discussion requests is exactly 1.
- Warning text, attachment URLs, unrelated enrolled-outside data and tokens do not enter results/logs. Missing required payload collections fail with generic OPERATION_FAILED.
- Write and view functions are rejected by the allow-list without fetch.

A whitespace/status review was also run:

```powershell
git diff --check; Write-Output "DIFF_CHECK_EXIT=$LASTEXITCODE"
git diff --stat
git status --short
```

The captured whitespace result was:

```text
warning: in the working copy of 'planning/active-task.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'planning/backlog.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/domain/moodle-adapter.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/rest-adapter.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/rest-client.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/mcp/server.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/moodle-values.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/integration/academic-tools.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/integration/mcp.test.ts', LF will be replaced by CRLF the next time Git touches it
DIFF_CHECK_EXIT=0
```

Git status showed only the listed changes plus the two pre-existing planning
changes, before this report existed. Git warned it could not read the global
ignore file. No claim of a live response check is made.

## 3. Explanation

The six strict MCP tool definitions reuse Phase 2 read-tool/read-result helpers.
Application use cases choose enrolled courses, validate date windows, compute
date/status logic and bound results. The domain adapter delegates to a focused
infrastructure reader that uses Zod plus parseResponse and maps only selected
fields. Existing own-user-ID caching and token redaction are reused; no academic
data cache, raw response logging or extra dependency was added.

Assignments are fetched with enrolled course IDs. The list sorts due dates
ascending, with missing dates last, and never requests individual submission
status. Detail first finds the assignment in the enrolled assignment result,
then requests status using assignid alone. DueState describes only the date;
overdue also checks submission state. Cutoff does not change overdue semantics.

Pending deadlines come from action events rather than inferring pending work
from all assignments. The default window starts 30 days before now and ends
14 days after now. includeOverdue=false starts at now. Requests and output are
capped at 200; the tool returns the requested count shape without a pagination
interface. Module URLs use the same activity-page filter as course contents.

Calendar uses one nested REST request for selected course IDs, user events and
site events. No per-course calendar loop is needed. Explicit course filtering
excludes unrelated/global events from that tool result. Date strings require a
timezone and output uses UTC, avoiding an assumed local timezone. Default is
seven days from the effective start; maximum interval is 92 elapsed days.

Grades use token-owner defaults for overview. Detailed grades use the cached
own ID and reject returned user/course mismatches. Raw numeric grade strings
are normalized; null/missing and Moodle's -1 sentinel are ungraded, while zero
remains a valid grade. Course-total items are separated from ordinary items.
The overview returns `{grades,count,truncated}`; detail returns
`{course,items,courseTotal,count,truncated}`. Both grade lists are capped at 200.
Assignment feedback grade, when present, is `{grade,rawGrade,gradedAt}`; a
formatted-only grade is preserved without inventing a raw grade.

Announcements query only enrolled news forums. Each forum's page zero is fetched
sequentially with perpage equal to the requested output limit. Discussion IDs are
deduplicated, sorted by latest modification (creation fallback), then limited
globally. No view call is made, so reads do not mark an item viewed. File and
attachment URLs are not copied from responses.

The interface deliberately folds the proposed moodle_get_submission_status into
moodle_get_assignment, moodle_get_course_grades into moodle_get_grades, and
moodle_get_announcement into moodle_get_announcements, which already includes
bounded message text. That provides the requested reads with six new tools.

## 4. Open issues and response-shape assumptions for live verification

All response-shape items below are **unverified in this task against live Moodle**.
Claude should verify them with the separately authorized account/run:

1. Assignments return `{courses:[{id,assignments:[...]}],warnings?}`. Each assignment
   has numeric positive id/cmid, string name, optional intro, and nonnegative
   Unix-second duedate/cutoffdate/allowsubmissionsfromdate. Intro is text-converted;
   null/missing timestamps become null. Course names come from the enrolled list,
   and unexpected non-enrolled course groups are not returned.
2. Submission status defaults to the token owner with only assignid. It uses
   `lastattempt.submission.status/timemodified`, with teamsubmission as fallback
   only when individual submission is absent, and `lastattempt.gradingstatus`.
   Missing data maps to unknown/null rather than a fabricated submitted state.
   Verify the site's group-assignment behavior matches this fallback.
3. Assignment feedback uses gradefordisplay, gradeddate and optional
   `feedback.grade.grade/timemodified`. Raw grade strings must be numeric.
   Feedback with no raw value can still supply a formatted grade. Unknown raw
   formats fail safely instead of being guessed.
4. Action events return `{events:[...]}` with numeric id, string name and Unix
   timesort. Course identity comes from `course.id` or courseid; course names are
   taken from the enrolled list. Optional modulename/url/action.actionable map
   to moduleType/activity-page URL/actionable. Unknown courses are omitted;
   events without course identity retain null course fields. Missing/zero
   timesort is omitted from the deadline window rather than treated as overdue.
5. Calendar returns `{events:[...]}` with numeric id, string name/eventtype,
   optional description/modulename/courseid/url and Unix timestart/timeduration.
   User/site events are treated as global even if Moodle uses the front-page
   course ID for a site event. Other non-enrolled course events are omitted.
   Filtering is by event start within the inclusive interval, not by overlap
   with a duration that started before the requested interval.
6. Overview grades return `{grades:[{courseid,grade,rawgrade}],warnings?}` without
   an explicit userid. Only enrolled courses are returned. Grade is display text,
   rawgrade may be a finite number/numeric string/null. Null/missing or -1 raw
   grade is treated as ungraded. Verify hidden-grade behavior and sentinel use.
7. Grade items return `{usergrades:[{userid,courseid?,gradeitems:[...]}],warnings?}`
   with zero or one owner record. Items use string itemname/itemtype, optional
   itemmodule, gradeformatted/graderaw, grademin/grademax, percentageformatted,
   feedback and gradedategraded. itemtype=course identifies the course total.
   Null/missing raw grades have grade=null and graded=false. A true zero is
   graded. Min/max can be signed numbers or numeric strings. Verify nullable
   item-name behavior and any extra sentinel/display formats before relaxing
   validation. Multiple returned user records fail safely.
8. Forums are either the usual bare array or `{forums:[...],warnings?}` and have
   numeric id/course plus string type. Only exact type=news is used. Discussions
   return `{discussions:[...],warnings?}` with numeric discussion (used as the
   discussion ID), string name, optional subject, userfullname, created,
   timemodified/modified, message and boolean/0/1 pinned. Subject prefers the
   explicit subject field, falling back to name. Missing authors/dates stay null.
9. Newest-announcement order is descending modification time, creation fallback.
   Only page=0 is requested, exactly as specified. If Moodle prioritizes pinned
   discussions ahead of newer ones in that page, the global result is newest
   among fetched candidates; it is not a complete multi-page history.
10. Numeric IDs are required; numeric ID strings and malformed required fields
    produce OPERATION_FAILED. Warning free text is ignored when data collections
    exist; warnings without the required collection do not substitute for data.
11. Activity URLs must be HTTPS `/mod/<name>/view.php` pages without embedded
    credentials or token/sesskey query parameters. Other returned URL forms are
    omitted. Constructed assignment/forum URLs use siteUrl and never file URLs.
12. Returned collections are bounded, but the unpaginated assignment/calendar
    endpoints can still return larger payloads before local filtering. Calendar
    and grade outputs cap at 200 with truncated; assignments default to 50 and
    cap at 200 with truncated. Deadlines cap at 200 without a truncated field;
    announcements cap at 50 and fetch at most that many per news forum. These
    two tools do not claim complete pagination coverage.

The shared HTML helper handles common/numeric entities and plain text limits; it
is not a complete browser parser. No user-local timezone was inferred; inputs
must identify their timezone. No files, downloads, writes, view logs or caching
beyond the existing own userid were implemented. Live verification remains for
Claude; no network, dependency install, repository `.env`, or commit was performed.

## Live-review fixes

This section supersedes the original grade-item type assumptions, single-request
deadline behavior and ascending-only assignment ordering above. Claude supplied
the live evidence; no live request was made while implementing these fixes.

### Changed files

- `src/infrastructure/moodle/academic-schemas.ts` — grade-item fields now require exactly the observed value types: nullable string itemname/itemmodule; nullable finite numeric graderaw; nullable nonnegative numeric gradedategraded; string gradeformatted/percentageformatted/feedback; finite numeric grademin/grademax; boolean gradeishidden. Missing fields or alternate types fail validation. Unrelated response fields remain stripped, following the existing schema pattern.
- `src/domain/academic.ts` — grade-item output name may be null.
- `src/infrastructure/moodle/academic-reads.ts` — null course-total names become `Course total`, other null names remain null; action events use cursor pagination with limitnum=50 and a maximum of 200 raw events.
- `src/domain/moodle-adapter.ts` — action-event reads return events plus truncated.
- `src/application/get-upcoming-deadlines.ts` — propagate pagination truncation into the tool output.
- `src/application/get-assignments.ts` — upcoming dates ascending, then past-due dates descending, then missing dates; ID breaks ties. Limits apply after sorting.
- `src/mcp/tools/get-assignments.ts` — describe the new ordering and direct pending-work queries to moodle_get_upcoming_deadlines.
- `src/mcp/tools/get-upcoming-deadlines.ts` — describe page size and conservative truncation at the collection cap.
- `tests/fixtures/academic.ts` — real-shaped grade items, including a null-name course total, numeric raw/min/max grades, nullable grade date and boolean hidden flag.
- `tests/unit/academic-reads.test.ts` — update the sentinel fixture to the verified numeric grade type.
- `tests/integration/phase3-tools.test.ts` — update ordering/page-size expectations and assert the deadline truncation field; the existing MCP grade-detail happy path now exercises a null-name course total.
- `tests/unit/live-review.test.ts` — regression tests for name fallbacks, strict observed grade types, cursor pagination/stopping/truncation and mixed assignment ordering.
- `planning/reports/phase-3.md` — append this review response and verification evidence.

### Verification

Exact command:

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

 Test Files  12 passed (12)
      Tests  193 passed (193)
   Start at  14:27:50
   Duration  1.15s (import 43%, tests 27%, transform 21%, setup 6%, worker 2%)
```

The added tests cover:

- Null-name course total → `Course total`; null ordinary item name → null; an existing non-null course-total name is preserved.
- Rejection of unexpected strings/numbers/null/missing values on the now strictly observed grade-item fields, including numeric-string raw grades and non-boolean gradeishidden.
- Action-event totals of 0, 49, 50, 55, 150, 199, 200 and 201. Every request has limitnum=50. Initial requests omit aftereventid; subsequent requests use the last ID of the previous raw page, with stable date bounds.
- A full page followed by an empty page stops correctly without truncation; a short final page stops immediately. At 200 collected events, exactly four requests are made and truncated is true.
- Pagination still advances from the raw page's last event when that event is excluded from output by course filtering. Repeated event IDs across pages fail with OPERATION_FAILED instead of allowing a non-advancing loop.
- Upcoming tasks, including due exactly now, precede past tasks; upcoming sorts soonest first, past sorts most recent first, and missing dates come last. A limit is applied to that final order.

### Explanation and limitations

Grade-item parsing now follows the supplied observations rather than accepting
numeric strings or absent fields for those items. The separate overview and
assignment-feedback schemas keep their prior accepted types; these changes do
not weaken owner checks or add user-ID inputs. gradeishidden is validated but
not added to the public output.

Deadlines are fetched sequentially using aftereventid, bounded by 200 collected
raw events (normally four full pages). Filtering and output sorting happen after
collection. The output is now `{deadlines,count,truncated}`. Reaching the cap on
a full page sets truncated=true conservatively: more items may exist, but no
fifth request is made solely to prove that. If some collected events are excluded
by course/date filtering, count can be below 200 while truncated remains true.

Assignment ordering improves the default bounded list without claiming that
listed tasks are pending; only the action-calendar tool represents pending work.
All prior token-owner, no-write/view and log-privacy constraints remain in force.
There were no network calls, dependency installs, real credentials, repository
`.env` changes or commits. Live confirmation of these fixes remains for Claude.
