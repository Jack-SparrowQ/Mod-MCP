import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../src/infrastructure/logging/logger.js';
import { RestClient } from '../../src/infrastructure/moodle/rest-client.js';
import { RestAdapter } from '../../src/infrastructure/moodle/rest-adapter.js';

const token = 'fixture_secret_token';
const fn = 'core_webservice_get_site_info';
function fixture(mock = vi.fn<typeof fetch>()) {
  const lines: string[] = [];
  const logger = createLogger('info', {write: line => { lines.push(line); }});
  const client = new RestClient({baseUrl: 'https://example.invalid/moodle/', token, logger, fetch: mock, timeoutMs: 10});
  return {client, mock, lines, logger};
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status});

describe('REST client', () => {
  it('uses a POST body, rejects redirects, times out, logs one safe line', async () => {
    const {client, mock, lines} = fixture();
    mock.mockResolvedValue(json({sitename: 'Fixture'}));
    await client.call(fn, {example: 1});
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, options] = mock.mock.calls[0];
    expect(String(url)).toBe('https://example.invalid/moodle/webservice/rest/server.php');
    expect(options).toMatchObject({method: 'POST', redirect: 'error'});
    expect(Object.fromEntries(options!.body as URLSearchParams)).toEqual({
      example: '1', wstoken: token, wsfunction: fn, moodlewsrestformat: 'json',
    });
    expect(options!.signal).toBeInstanceOf(AbortSignal);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({function: fn, outcome: 'OK', durationMs: expect.any(Number)});
    expect(lines.join('')).not.toContain(token);
  });
  it('rejects unsupported functions and missing token without fetch', async () => {
    const {client, mock, lines, logger} = fixture();
    await expect(client.call(token)).rejects.toMatchObject({code: 'INTEGRATION_UNSUPPORTED'});
    await expect(new RestClient({baseUrl: 'https://example.invalid/', logger, fetch: mock}).call(fn))
      .rejects.toMatchObject({code: 'AUTH_REQUIRED'});
    expect(mock).not.toHaveBeenCalled();
    expect(lines.join('')).not.toContain(token);
  });
  it('rejects overriding protocol fields without fetch', async () => {
    const {client, mock} = fixture();
    await expect(client.call(fn, {wsfunction: 'write'})).rejects.toMatchObject({code: 'VALIDATION_ERROR'});
    expect(mock).not.toHaveBeenCalled();
  });
  it.each([
    ['invalidtoken', 'SESSION_EXPIRED'], ['accessexception', 'PERMISSION_DENIED'],
    ['nopermissions', 'PERMISSION_DENIED'], ['requireloginerror', 'PERMISSION_DENIED'],
    ['servicenotavailable', 'INTEGRATION_UNSUPPORTED'], ['webservicesnotenabled', 'INTEGRATION_UNSUPPORTED'],
    ['webserviceisdisabled', 'INTEGRATION_UNSUPPORTED'], ['unexpectedcode', 'OPERATION_FAILED'],
    [token, 'OPERATION_FAILED'],
  ])('maps Moodle %s to %s without secrets', async (errorcode, code) => {
    const {client, mock, lines} = fixture();
    mock.mockResolvedValue(json({errorcode, message: token, exception: token}));
    const error = await client.call(fn).catch(error => error);
    expect(error.code).toBe(code);
    expect(error.context.errorcode).toBe(errorcode === token ? '[REDACTED]' : errorcode);
    expect(`${error.stack}${JSON.stringify(error)}${lines.join('')}`).not.toContain(token);
  });
  it.each(['network', 'timeout', 'server', 'invalidjson', 'invalidshape', 'http400'])('handles %s safely', async kind => {
    const {client, mock, lines} = fixture();
    if (kind === 'network') mock.mockRejectedValue(new Error(token));
    if (kind === 'timeout') mock.mockImplementation(async (_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new Error(token)), {once: true});
    }));
    if (kind === 'server') mock.mockResolvedValue(json({message: token}, 503));
    if (kind === 'http400') mock.mockResolvedValue(json({message: token}, 400));
    if (kind === 'invalidjson') mock.mockResolvedValue(new Response(token));
    if (kind === 'invalidshape') mock.mockResolvedValue(json(null));
    const error = await client.call(fn).catch(error => error);
    expect(error.code).toBe(kind === 'http400' ? 'OPERATION_FAILED' : 'MOODLE_UNAVAILABLE');
    expect(`${error.stack}${JSON.stringify(error)}${lines.join('')}`).not.toContain(token);
  });
  it('redacts logger token fields', () => {
    const {logger, lines} = fixture();
    logger.info({token, wstoken: token, privatetoken: token, password: token, MOODLE_TOKEN: token, nested: {token}});
    expect(lines.join('')).not.toContain(token);
  });
  it('adapter only returns site fields and redacts echoed token', async () => {
    const {client, mock} = fixture();
    mock.mockResolvedValue(json({sitename: `School ${token}`, release: '4.1', version: '1', lang: 'es',
      username: 'private', fullname: 'private', email: 'private', userid: 123, token}));
    expect(await new RestAdapter(client).getSiteInfo()).toEqual({
      sitename: 'School [REDACTED]', release: '4.1', version: '1', lang: 'es',
    });
  });
  it('adapter rejects malformed site info', async () => {
    const {client, mock} = fixture();
    mock.mockResolvedValue(json({sitename: {token}}));
    await expect(new RestAdapter(client).getSiteInfo()).rejects.toMatchObject({code: 'OPERATION_FAILED'});
  });
});
