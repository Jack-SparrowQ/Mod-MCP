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
