import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';

export function upsertEnvLine(text, key, value) {
  if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || /[\r\n\0]/.test(value)) {
    throw new Error('Invalid environment entry.');
  }
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  // JSON quoting protects #, spaces and quotes in Node's env-file parser.
  const line = `${key}=${JSON.stringify(value)}`;
  const lines = text ? text.split(/\r?\n/) : [];
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`);
  let replaced = false;
  const result = lines.flatMap(existing => {
    if (!pattern.test(existing)) return [existing];
    if (replaced) return [];
    replaced = true;
    return [line];
  });
  if (!replaced) {
    if (result.at(-1) === '') result.pop();
    result.push(line, '');
  }
  return result.join(newline);
}

// Password characters are consumed in raw mode and never echoed, including paste.
function hiddenPassword() {
  const input = process.stdin;
  process.stderr.write('Password: ');
  return new Promise((resolve, reject) => {
    let password = '';
    const priorRaw = input.isRaw;
    const cleanup = () => {
      input.off('data', onData);
      input.off('end', onEnd);
      input.off('error', onError);
      input.setRawMode(priorRaw);
      input.pause();
      process.stderr.write('\n');
    };
    const onEnd = () => { cleanup(); reject(new Error('Input closed.')); };
    const onError = () => { cleanup(); reject(new Error('Input failed.')); };
    const onData = chunk => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003' || char === '\u0004') {
          cleanup(); reject(new Error('Cancelled.')); return;
        }
        if (char === '\r' || char === '\n') { cleanup(); resolve(password); return; }
        if (char === '\u007f' || char === '\b') password = Array.from(password).slice(0, -1).join('');
        else if (char >= ' ') password += char;
      }
    };
    input.setRawMode(true);
    input.on('data', onData);
    input.once('end', onEnd);
    input.once('error', onError);
    input.resume();
  });
}

async function main() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run npm run token in an interactive TTY.');
  }
  try { process.loadEnvFile(); } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Unable to read .env.');
  }
  let base;
  try {
    base = new URL(process.env.MOODLE_BASE_URL || 'https://moodle.itescam.edu.mx/moodle4/');
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error();
    if (!base.pathname.endsWith('/')) base.pathname += '/';
  } catch { throw new Error('Invalid MOODLE_BASE_URL.'); }

  const terminal = createInterface({input: process.stdin, output: process.stderr});
  let username;
  try { username = await terminal.question('Username: '); } finally { terminal.close(); }
  const password = await hiddenPassword();
  if (!username || !password) throw new Error('Username and password are required.');
  let data;
  try {
    const response = await fetch(new URL('login/token.php', base), {
      method: 'POST', body: new URLSearchParams({username, password, service: 'moodle_mobile_app'}),
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error();
    data = await response.json();
  } catch { throw new Error('Token request failed.'); }
  if (data?.error || data?.errorcode || data?.exception) {
    // Accept code identifiers only; never echo the server's free-text message.
    const code = typeof data.errorcode === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(data.errorcode)
      && !data.errorcode.includes(password) && !data.errorcode.includes(username)
      ? data.errorcode : 'unknownerror';
    throw new Error(code);
  }
  if (typeof data?.token !== 'string' || !/^[a-zA-Z0-9]+$/.test(data.token)) {
    throw new Error('Invalid token response.');
  }
  let text = '';
  try { text = await readFile('.env', 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Unable to read .env.');
  }
  try { await writeFile('.env', upsertEnvLine(text, 'MOODLE_TOKEN', data.token), {mode: 0o600}); }
  catch { throw new Error('Unable to save .env.'); }
  process.stderr.write('Token saved to .env\n');
}

if (import.meta.main) {
  try { await main(); } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
