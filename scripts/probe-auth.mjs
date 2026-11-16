import assert from 'node:assert/strict';

const required = [
  'core_webservice_get_site_info',
  'core_course_get_courses',
  'core_enrol_get_users_courses',
  'mod_assign_get_assignments',
  'mod_assign_get_submissions',
  'gradereport_user_get_grade_items',
  'core_calendar_get_calendar_events',
  'core_course_get_contents',
  'mod_assign_get_submission_status',
  'mod_forum_get_forum_discussions',
  'core_calendar_get_action_events_by_timesort',
  'gradereport_overview_get_course_grades',
];
const fields = [
  'release', 'version', 'sitename', 'lang', 'userissiteadmin',
  'downloadfiles', 'uploadfiles', 'usercanmanageownfiles',
];

// Copy only scalar allow-listed metadata; never spread the server response.
// Missing/invalid metadata becomes null rather than disappearing from the JSON.
export function summarize(siteInfo) {
  const summary = Object.fromEntries(fields.map(key => {
    const value = siteInfo?.[key];
    const safeValue = typeof value === 'string'
      ? value.replace(/[^\s<>@]+@[^\s<>@]+/g, '[REDACTED EMAIL]')
      : typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
        ? value : null;
    return [key, safeValue];
  }));
  const functions = [...new Set((Array.isArray(siteInfo?.functions) ? siteInfo.functions : [])
    .map(entry => entry?.name)
    .filter(name => typeof name === 'string' && /^[a-z][a-z0-9]*_[a-z0-9_]+$/.test(name)))].sort();
  return {
    ...summary,
    functionCount: functions.length,
    functions,
    requiredFunctions: Object.fromEntries(required.map(name => [name, functions.includes(name)])),
  };
}

// No response body, exception message, URL, or request options enter diagnostics.
async function probe(env, request = fetch) {
  if (!env.MOODLE_USERNAME || !env.MOODLE_PASSWORD) {
    throw new Error('Missing required environment variables: MOODLE_USERNAME and MOODLE_PASSWORD.');
  }
  let base;
  try {
    base = new URL(env.MOODLE_BASE_URL || 'https://moodle.itescam.edu.mx/moodle4/');
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
      throw new Error();
    }
    if (!base.pathname.endsWith('/')) base.pathname += '/';
  } catch {
    throw new Error('Invalid MOODLE_BASE_URL: use an HTTPS base URL without credentials, query, or fragment.');
  }

  async function post(path, params) {
    let response;
    let data;
    try {
      response = await request(new URL(path, base), {
        method: 'POST',
        body: new URLSearchParams(params),
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error();
      data = await response.json();
    } catch {
      throw new Error('Request failed (HTTP, network, redirect, timeout, or invalid JSON).');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid response shape.');
    }
    if (data.error || data.exception || data.errorcode) {
      // Moodle error messages can echo personal data; expose only a valid code.
      throw new Error(typeof data.errorcode === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(data.errorcode)
        ? data.errorcode : 'unknownerror');
    }
    return data;
  }

  const tokenData = await post('login/token.php', {
    username: env.MOODLE_USERNAME,
    password: env.MOODLE_PASSWORD,
    service: 'moodle_mobile_app',
  });
  if (typeof tokenData.token !== 'string' || !tokenData.token) {
    throw new Error('Token missing from response.');
  }
  const siteInfo = await post('webservice/rest/server.php', {
    wstoken: tokenData.token,
    wsfunction: 'core_webservice_get_site_info',
    moodlewsrestformat: 'json',
  });
  return summarize(siteInfo);
}

async function selfTest() {
  // Replace fetch even in tests so accidental use cannot contact any host.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network forbidden in self-test'); };
  try {
    const fixture = {
      release: 'fixture-release', version: 'fixture-version', sitename: 'Fixture School', lang: 'en',
      userissiteadmin: false, downloadfiles: 1, uploadfiles: 0, usercanmanageownfiles: 1,
      token: 'FAKE_TOKEN_SENTINEL', privatetoken: 'FAKE_PRIVATE_SENTINEL',
      username: 'FAKE_USERNAME_SENTINEL', password: 'FAKE_PASSWORD_SENTINEL',
      fullname: 'FAKE_FULLNAME_SENTINEL', firstname: 'FAKE_FIRST_SENTINEL',
      lastname: 'FAKE_LAST_SENTINEL', userid: 987654321,
      email: 'fixture-person@example.invalid', userpictureurl: 'https://example.invalid/private-picture',
      functions: [{name: required[1]}, {name: required[0]}, {name: required[1]}],
    };
    const summary = summarize(fixture);
    const serialized = JSON.stringify(summary);
    for (const key of ['token', 'privatetoken', 'username', 'password', 'fullname', 'firstname',
      'lastname', 'userid', 'email', 'userpictureurl']) {
      assert.ok(!serialized.includes(String(fixture[key])), `Private field leaked: ${key}`);
    }
    assert.deepEqual(Object.keys(summary), [...fields, 'functionCount', 'functions', 'requiredFunctions']);
    assert.deepEqual(summary.functions, [required[1], required[0]].sort());
    assert.equal(summary.functionCount, 2);
    assert.deepEqual(summary.requiredFunctions, Object.fromEntries(required.map((name, i) => [name, i < 2])));
    assert.deepEqual(summarize({}).functions, []);
    assert.equal(summarize({sitename: {email: fixture.email}}).sitename, null);
    assert.equal(summarize({sitename: fixture.email}).sitename, '[REDACTED EMAIL]');

    let calls = 0;
    const env = {MOODLE_USERNAME: fixture.username, MOODLE_PASSWORD: fixture.password};
    const mock = async (url, options) => {
      calls++;
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.equal(url.search, '');
      assert.ok(options.body instanceof URLSearchParams);
      assert.ok(options.signal instanceof AbortSignal);
      if (calls === 1) {
        assert.equal(url.pathname, '/moodle4/login/token.php');
        assert.deepEqual(Object.fromEntries(options.body), {
          username: fixture.username, password: fixture.password, service: 'moodle_mobile_app',
        });
        return {ok: true, json: async () => ({token: fixture.token, privatetoken: fixture.privatetoken})};
      }
      assert.equal(calls, 2);
      assert.equal(url.pathname, '/moodle4/webservice/rest/server.php');
      assert.deepEqual(Object.fromEntries(options.body), {
        wstoken: fixture.token, wsfunction: required[0], moodlewsrestformat: 'json',
      });
      return {ok: true, json: async () => fixture};
    };
    assert.deepEqual(await probe(env, mock), summary);
    assert.equal(calls, 2);
    let failedCalls = 0;
    await assert.rejects(probe({}, async () => { failedCalls++; }), /Missing required environment variables/);
    assert.equal(failedCalls, 0);
    await assert.rejects(probe(env, async () => {
      failedCalls++;
      return {ok: true, json: async () => ({error: fixture.email, errorcode: 'invalidlogin'})};
    }), {message: 'invalidlogin'});
    assert.equal(failedCalls, 1);
    await assert.rejects(probe(env, async () => { throw new Error(fixture.password); }), {
      message: 'Request failed (HTTP, network, redirect, timeout, or invalid JSON).',
    });
    console.log('SELF-TEST PASS: summary allow-list, secret/email exclusion, required functions, two POST bodies, missing-env no-request, sanitized failures; no network.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

if (import.meta.main) {
  try {
    if (process.argv.includes('--self-test')) await selfTest();
    else console.log(JSON.stringify(await probe(process.env)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
