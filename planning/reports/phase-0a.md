# Phase 0a report

## 1. Changed files

- `docs/moodle-investigation.md` — request/status/excerpt/conclusion evidence and Phase 0b verification requirements.
- `scripts/probe-public.mjs` — dependency-free Node fetch probe; seven sequential public GETs, manual redirects, timeout, no cookies, sanitized output.
- `planning/reports/phase-0a.md` — this requested report and verification evidence.

## 2. Verification

Command: `node scripts/probe-public.mjs`.
Initial sandbox result: exit 1, `{"request":"https://moodle.itescam.edu.mx/moodle4/login/index.php","error":"fetch failed","cause":"EACCES"}`.
Reran with network escalation; final verification run exited 0. Its stdout follows:

```jsonl
{"request":"https://moodle.itescam.edu.mx/moodle4/login/index.php","status":200,"contentType":"text/html; charset=utf-8","evidence":{"title":"Administrador de Cursos del ITESCAM: Ingresar al sitio","generator":null,"forms":["<form class=\"login-form\" action=\"https://moodle.itescam.edu.mx/moodle4/login/index.php\" method=\"post\" id=\"login\">"],"inputs":["<input type=\"hidden\" name=\"logintoken\" value=\"[REDACTED]\">","<input type=\"text\" name=\"username\" id=\"username\" class=\"form-control form-control-lg\" value=\"[REDACTED]\" placeholder=\"Nombre_de_usuario\" autocomplete=\"username\">","<input type=\"password\" name=\"password\" id=\"password\" value=\"[REDACTED]\" class=\"form-control form-control-lg\" placeholder=\"Contraseña\" autocomplete=\"current-password\">"],"assets":["href=\"https://moodle.itescam.edu.mx/moodle4/theme/yui_combo.php?rollup/3.17.2/yui-moodlesimple-min.css\"","href=\"https://moodle.itescam.edu.mx/moodle4/theme/styles.php/classic/1794237714_1/all\"","src=\"https://moodle.itescam.edu.mx/moodle4/lib/javascript.php/1794237714/lib/polyfills/polyfill.js\"","src=\"https://moodle.itescam.edu.mx/moodle4/theme/yui_combo.php?rollup/3.17.2/yui-moodlesimple-min.js\"","src=\"https://moodle.itescam.edu.mx/moodle4/lib/javascript.php/1794237714/lib/javascript-static.js\"","src=\"https://moodle.itescam.edu.mx/moodle4/lib/javascript.php/1794237714/lib/requirejs/require.min.js\""],"indicators":["ummary</a></div><a href=\"https://download.moodle.org/mobile?version=2022112801.02&amp;lang=es_mx&amp;iosappid=633359593&amp;androidappid=com.moodle.moodlemobile\">Get t"],"configHints":["\"themerev\":\"1794237714\"","\"theme\":\"classic\"","\"jsrev\":\"1794237714\""]}}
{"request":"https://moodle.itescam.edu.mx/moodle4/lib/upgrade.txt","status":200,"contentType":"text/plain","evidence":"This files describes API changes in core libraries and APIs,\ninformation provided here is intended especially for developers.\n\n=== 4.1.1 ===\n\n* There is a new helper function mtrace_exception to help with reporting exceptions you have caught in scheduled tasks.\n\n=== 4.1 ===\n\n* HT"}
{"request":"https://moodle.itescam.edu.mx/moodle4/webservice/rest/server.php","status":200,"contentType":"application/xml; charset=utf-8","evidence":"<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n<EXCEPTION class=\"moodle_exception\">\n<ERRORCODE>invalidtoken</ERRORCODE>\n<MESSAGE>Ficha (token) no válida  - token no encontrado</MESSAGE>\n</EXCEPTION>\n"}
{"request":"https://moodle.itescam.edu.mx/moodle4/login/token.php","status":200,"contentType":"application/json; charset=utf-8","evidence":"{\"error\":\"Un par\\u00e1metro necesario (username) faltaba\",\"errorcode\":\"missingparam\",\"stacktrace\":null,\"debuginfo\":null,\"reproductionlink\":null}"}
{"request":"https://moodle.itescam.edu.mx/moodle4/admin/tool/mobile/launch.php","status":404,"contentType":"text/html; charset=utf-8","evidence":"[existence/status only; body omitted]"}
{"request":"https://moodle.itescam.edu.mx/moodle4/lib/ajax/service-nologin.php","status":200,"contentType":"application/json; charset=utf-8","evidence":"{\"error\":\"Detectado un error de codificaci\\u00f3n, debe ser corregido por un programador: Invalid json in request: Syntax error\",\"errorcode\":\"codingerror\",\"stacktrace\":null,\"debuginfo\":null,\"reproductionlink\":null}"}
{"request":"https://moodle.itescam.edu.mx/moodle4/lib/ajax/service-nologin.php?info=tool_mobile_get_public_config&args=%5B%7B%22index%22%3A0%2C%22methodname%22%3A%22tool_mobile_get_public_config%22%2C%22args%22%3A%7B%7D%7D%5D","status":200,"contentType":"application/json; charset=utf-8","evidence":[{"error":false,"data":{"enablewebservices":1,"enablemobilewebservice":1,"typeoflogin":1,"launchurl":"https://moodle.itescam.edu.mx/moodle4/admin/tool/mobile/launch.php","maintenanceenabled":0,"warnings":[]}}]}
```

The shell also emitted a local PowerShell profile warning: `Set-PSReadLineOption ... The handle is invalid.` This did not prevent execution.

Commands: `node --check scripts/probe-public.mjs`; `git diff --check`; `git status --short` (executed in that order in one shell call).
Result: exit 0; syntax and diff checks emitted no errors. Git warned about LF/CRLF in the pre-existing modified planning file and inability to read the global ignore file. Status output:

```text
 M planning/active-task.md
?? docs/moodle-investigation.md
?? scripts/
```

This status was captured before creating this report. No tests were required by the investigation spec; no dependencies were installed. An earlier inline Node command failed with a PowerShell quoting SyntaxError before any request; moving it to the optional script resolved that.

## 3. Explanation

The script fetches each approved public endpoint once per run, reads the response,
and prints status plus selected evidence. It does not follow redirects, retain
cookies, submit forms, or send credentials. A first successful pass had overly
verbose output; the final pass restricts version-file excerpts, omits the launch
HTML, and projects mobile configuration fields to exclude support contacts.
There were 14 successful HTTP exchanges total, with no enumeration or retries
against authentication. The final output above is the reproducible sanitized run.

Web Services and mobile service flags are explicitly enabled. REST rejects a
missing token and the token handler rejects missing username. Strategy A is
therefore plausible, but obtaining a usable token and exercising permitted reads
requires Phase 0b. Login HTML and upgrade notes suggest Moodle 4.1; exact release
remains unverified. Browser automation and authenticated probing were unnecessary
for this phase and were not used.

## 4. Open issues

- Bare mobile launch returns 404 despite being advertised; parameterized launch behavior is unverified.
- Token issuance, account permissions, available functions, MFA/SSO/CAPTCHA beyond initial HTML, and exact running release remain unverified.
- Phase 0b needs explicit human authorization and an approved account. No secrets or personal data are stored in these artifacts.
- `planning/active-task.md` was already modified on entry and was not edited. No out-of-scope file was edited and nothing was committed.
