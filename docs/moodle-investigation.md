# Moodle public investigation — Phase 0a

Observed 2026-11-16. Base URL: https://moodle.itescam.edu.mx/moodle4/.
Only unauthenticated HTTP GETs were sent. No credentials, cookies, login submissions,
tokens, or authenticated calls were used. Redirects were not followed. Two successful
passes of seven requests were made (the second verified concise sanitized output).
An initial sandbox attempt failed with EACCES before receiving an HTTP response.
Reproduce with `node scripts/probe-public.mjs`; no dependencies are required.

## Login and version hints

Request: `GET https://moodle.itescam.edu.mx/moodle4/login/index.php`

HTTP 200, `text/html; charset=utf-8`. Relevant excerpts:

```html
<title>Administrador de Cursos del ITESCAM: Ingresar al sitio</title>
<form class="login-form" action="https://moodle.itescam.edu.mx/moodle4/login/index.php" method="post" id="login">
```

Input names: `logintoken` (hidden), `username` (text), `password` (password).
Input values are deliberately omitted. No generator meta matching the probe was found.
The page's configuration contains `"theme":"classic"`, `"themerev":"1794237714"`,
and `"jsrev":"1794237714"`. Assets include
`theme/styles.php/classic/1794237714_1/all` and
`lib/javascript.php/1794237714/lib/requirejs/require.min.js`.
The public app download link contains `version=2022112801.02`.

Conclusion: a conventional username/password form is exposed. No CAPTCHA, reCAPTCHA,
OAuth2, SAML, OpenID, or identity-provider markers matched the returned HTML.
Their absence in all possible authentication flows is **unverified**; no JavaScript
was executed and no login was attempted. Asset revisions are cache identifiers,
not Moodle release numbers. The advertised version is a hint, not proof of the
exact running release or patch level.

## Public upgrade file

Request: `GET https://moodle.itescam.edu.mx/moodle4/lib/upgrade.txt`

HTTP 200, `text/plain`. Excerpt:

```text
This files describes API changes in core libraries and APIs,
information provided here is intended especially for developers.

=== 4.1.1 ===
```

Conclusion: the public file and login version hint are consistent with the Moodle
4.1 family. Exact deployed release/build is **unverified**: a static upgrade file
may be stale or customized. No additional version paths were enumerated.

## REST endpoint without a token

Request: `GET https://moodle.itescam.edu.mx/moodle4/webservice/rest/server.php`

HTTP 200, `application/xml; charset=utf-8`. Excerpt:

```xml
<EXCEPTION class="moodle_exception">
<ERRORCODE>invalidtoken</ERRORCODE>
<MESSAGE>Ficha (token) no válida  - token no encontrado</MESSAGE>
</EXCEPTION>
```

Conclusion: REST dispatch is reachable and rejects a missing token. This is an
application error despite HTTP 200, not a web-services-disabled response.
Successful authenticated calls and account permissions remain **unverified**.

## Token endpoint without credentials

Request: `GET https://moodle.itescam.edu.mx/moodle4/login/token.php`

HTTP 200, `application/json; charset=utf-8`. Relevant excerpt (JSON decoded):

```json
{"error":"Un parámetro necesario (username) faltaba","errorcode":"missingparam"}
```

Conclusion: the token handler exists and validates required parameters. No service,
username, or password was supplied. Issuing a token for `moodle_mobile_app`, account
eligibility, and additional authentication requirements remain **unverified**.

## Mobile launch route

Request: `GET https://moodle.itescam.edu.mx/moodle4/admin/tool/mobile/launch.php`

HTTP 404, `text/html; charset=utf-8`. Body deliberately omitted: existence/status
probe only. Conclusion: the bare launch route returned 404, although the public
configuration advertises it. Behavior with valid mobile launch parameters and
browser/SSO integration is **unverified**. This result does not override the explicit
mobile-service-enabled flag below.

## Nologin AJAX endpoint

Request: `GET https://moodle.itescam.edu.mx/moodle4/lib/ajax/service-nologin.php`

HTTP 200, `application/json; charset=utf-8`. Relevant excerpt:

```json
{"error":"Detectado un error de codificación, debe ser corregido por un programador: Invalid json in request: Syntax error","errorcode":"codingerror"}
```

Conclusion: the endpoint responds; the bare GET lacks the required JSON arguments.
This response alone does not establish mobile support.

## Public mobile configuration

Request (GET; JSON arguments encoded in the query, no POST body):

```text
https://moodle.itescam.edu.mx/moodle4/lib/ajax/service-nologin.php?info=tool_mobile_get_public_config&args=%5B%7B%22index%22%3A0%2C%22methodname%22%3A%22tool_mobile_get_public_config%22%2C%22args%22%3A%7B%7D%7D%5D
```

HTTP 200, `application/json; charset=utf-8`. Relevant response projection:

```json
[{"error":false,"data":{"enablewebservices":1,"enablemobilewebservice":1,"typeoflogin":1,"launchurl":"https://moodle.itescam.edu.mx/moodle4/admin/tool/mobile/launch.php","maintenanceenabled":0,"warnings":[]}}]
```

Conclusion: public configuration explicitly reports Web Services and the mobile
service enabled, with maintenance disabled. `typeoflogin` is preserved as a raw
value; its exact behavior on this installation is **unverified**.

Reviewer note (Claude): in Moodle core, `tool_mobile\api::LOGIN_VIA_APP = 1`
(2 = browser, 3 = embedded browser). Value 1 means the mobile app collects
username/password itself and exchanges them at `login/token.php` with
`service=moodle_mobile_app`. This is the hypothesis Phase 0b must confirm first. Support contact
fields and other unnecessary public configuration are excluded from artifacts.

## Strategy A and Phase 0b

Strategy A (Web Services / mobile token) is plausible and has strong public evidence:
enabled flags, reachable REST token validation, and a reachable token handler.
It is not yet an authenticated integration verification.

Phase 0b requires explicit human authorization and an approved account to verify:

1. Whether `moodle_mobile_app` can issue a token for that account; identify any SSO,
   CAPTCHA, MFA, policy, or account-specific restrictions without logging secrets.
2. A minimal authenticated read such as site information, its actual version, and
   the functions granted to that token. Validate required read capabilities against
   the product requirements before implementing them.
3. Token lifetime/revocation and secure local storage; role/enrolment restrictions
   and representative read-only responses, with personal data excluded from reports.
4. Whether the 404 launch route matters for the selected authentication flow.

No fallback browser authentication or API capability should be treated as verified
from these public observations alone.

---

# Authenticated investigation — Phase 0b

Observed 2026-11-16. Run by the user with their own student account:
`node --env-file=.env scripts/probe-auth.mjs` (two POSTs: `login/token.php` with
`service=moodle_mobile_app`, then `core_webservice_get_site_info`). Token and identity
fields were never printed.

## Result

| Field | Value |
|---|---|
| release | `4.1.1+ (Build: 20230126)` — confirms the 0a hint |
| version | `2022112801.02` |
| lang | `es_mx` |
| userissiteadmin | `false` |
| downloadfiles / uploadfiles | `1` / `1` |
| usercanmanageownfiles | `true` |
| functionCount | 393 (service `moodle_mobile_app`) |

Token issuance via username/password works for a student account (confirms `typeoflogin=1`).

All 12 candidate functions are available:
`core_webservice_get_site_info`, `core_course_get_courses`, `core_enrol_get_users_courses`,
`core_course_get_contents`, `mod_assign_get_assignments`, `mod_assign_get_submissions`,
`mod_assign_get_submission_status`, `gradereport_user_get_grade_items`,
`gradereport_overview_get_course_grades`, `core_calendar_get_calendar_events`,
`core_calendar_get_action_events_by_timesort`, `mod_forum_get_forum_discussions`.

Also relevant for later phases: `mod_resource_get_resources_by_courses`,
`mod_folder_get_folders_by_courses`, `mod_url_get_urls_by_courses`,
`mod_forum_get_forums_by_courses`, `mod_forum_get_discussion_posts`,
`core_calendar_get_calendar_upcoming_view`, `core_course_search_courses`,
`core_user_get_users_by_field`; writes (Phase 5): `mod_assign_save_submission`,
`mod_assign_submit_for_grading`, plus file upload (`uploadfiles=1`, `webservice/upload.php`).
Downloads should use `webservice/pluginfile.php` with the token (`downloadfiles=1`).

## Caveats

- A function in the service list is **callable**, not **permitted**: Moodle still checks the
  user's capabilities per call. Teacher functions in the list (`mod_assign_save_grade`,
  `core_grades_grader_gradingpanel_point_store`, ...) will fail for a student and must never be
  exposed by the MCP server anyway (requirements §11.3).
- Response shapes for each function are not yet verified against this site; each Phase 2–3 task
  verifies its function with one real read before relying on it.
- Token lifetime and revocation behavior remain unverified.

## Conclusion

**Strategy A (Web Services REST with a mobile-service token) is verified** for every MVP read
capability. Playwright is not needed for the MVP. Decision: `docs/decisions/0002-integration-strategy.md`.

---

# Live verification — Phase 2 tools

2026-11-16, user's account, read-only, via an SDK stdio client against `dist/index.js`. Only response
shapes were printed, never personal or course data.

- `moodle_get_profile`: `id`, `fullname`, `username`, `email`, `profileUrl` all present
  (`core_user_get_users_by_field` returns the own email for a student).
- `moodle_get_courses`: 32 enrolled courses; all assumed field types hold. `endDate` null in 21,
  `progress` null in 30 (completion tracking mostly off). Accent-insensitive query and
  not-enrolled `courseId` → `RESOURCE_NOT_FOUND` work.
- `moodle_get_course_contents`: 32/32 courses parse with the strict schemas; 299 sections;
  modules: assign 421, resource 75, forum 35, label 17, quiz 16, url 15, folder 5, feedback 2,
  data 1; 105 file-metadata entries; 568 modules with view URL, 19 without (labels etc.);
  no module used `availabilityinfo`/`availability`.
- Leak scan over all outputs (185 KB): 0 `pluginfile`, 0 `token=`, token value absent.

---

# Live verification — Phase 3 tools

2026-11-16, user's account, read-only, shapes/counts only.

Discovered behaviour (not documented in our candidates list, fixed in code):
- `core_calendar_get_action_events_by_timesort` rejects `limitnum > 50`; its error puts a free-text
  sentence in `errorcode`. Tool now pages with `aftereventid`.
- `gradereport_user_get_grade_items`: the course-total item has `itemname: null` (1 per course);
  over 494 items `graderaw` and `gradedategraded` are mostly null (ungraded), `grademin`/`grademax`
  always numbers.
- All 32 news forums have 0 discussions, so `moodle_get_announcements` correctly returns 0.

Results after fixes: assignments (421 total; default view now upcoming first: 22 upcoming + 28 past
in the first 50), assignment detail 15/15 (12 submitted, 3 new+overdue), deadlines 20 pending
(5 overdue, all with activity URLs), calendar 37 events in a 90-day window, grades overview 32
courses and per-course 32/32 (462 items, 30 graded). Leak scan over 143 KB: clean.
