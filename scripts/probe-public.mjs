// Public GETs only. Never persist cookies, input values, or complete login HTML.
const base = 'https://moodle.itescam.edu.mx/moodle4/';
const paths = [
  'login/index.php', 'lib/upgrade.txt', 'webservice/rest/server.php',
  'login/token.php', 'admin/tool/mobile/launch.php',
  'lib/ajax/service-nologin.php',
  'lib/ajax/service-nologin.php?info=tool_mobile_get_public_config&args=' +
    encodeURIComponent(JSON.stringify([{index: 0, methodname: 'tool_mobile_get_public_config', args: {}}])),
];
for (const path of paths) {
  const request = base + path;
  try {
    const response = await fetch(request, {redirect: 'manual', signal: AbortSignal.timeout(15000)});
    const body = await response.text();
    let evidence = path === 'login/index.php' ? {
      title: body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
      generator: body.match(/<meta[^>]*name="generator"[^>]*>/gi),
      forms: body.match(/<form\b[^>]*>/gi),
      inputs: [...body.matchAll(/<input\b[^>]*>/gi)].map(([tag]) => tag.replace(/value="[^"]*"/gi, 'value="[REDACTED]"')),
      assets: body.match(/(?:src|href)="[^"]*(?:theme|requirejs|javascript)[^"]*"/gi),
      indicators: body.match(/.{0,60}(?:captcha|recaptcha|oauth2|saml|openid|login-identityproviders|release|version).{0,100}/gi),
      configHints: body.match(/"(?:themerev|jsrev|theme|version|release)"\s*:\s*(?:"[^"]*"|\d+)/g),
    } : body.slice(0,2000);
    if (path === 'lib/upgrade.txt') evidence = body.slice(0,280);
    if (path === 'admin/tool/mobile/launch.php') evidence = '[existence/status only; body omitted]';
    if (path.includes('?info=')) {
      const result = JSON.parse(body);
      evidence = result.map(item => ({error: item.error, data: item.data && Object.fromEntries(
        ['enablewebservices', 'enablemobilewebservice', 'typeoflogin', 'launchurl', 'maintenanceenabled', 'warnings']
          .map(key => [key, item.data[key]]))}));
    }
    console.log(JSON.stringify({request, status: response.status, contentType: response.headers.get('content-type'), evidence}));
  } catch (error) {
    console.log(JSON.stringify({request, error: error.message, cause: error.cause?.code}));
    // Stop on transport failure rather than repeatedly contacting an unreachable host.
    process.exitCode = 1;
    break;
  }
}
