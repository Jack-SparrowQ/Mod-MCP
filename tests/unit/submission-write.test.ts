import { expect, it, vi } from 'vitest';
import { RestClient, WRITE_FUNCTIONS } from '../../src/infrastructure/moodle/rest-client.js';
import { createLogger } from '../../src/infrastructure/logging/logger.js';

it.each(WRITE_FUNCTIONS)('plain call refuses write function %s without fetch', async fn => {
  const mock = vi.fn<typeof fetch>();
  const client = new RestClient({baseUrl: 'https://example.invalid/', token: 'fake', logger: createLogger('silent'), fetch: mock});
  await expect(client.call(fn, {assignmentid: 1})).rejects.toMatchObject({code: 'INTEGRATION_UNSUPPORTED'});
  expect(mock).not.toHaveBeenCalled();
});
it('explicit write cannot call read functions or send userid', async () => {
  const mock = vi.fn<typeof fetch>();
  const client = new RestClient({baseUrl: 'https://example.invalid/', token: 'fake', logger: createLogger('silent'), fetch: mock});
  await expect(client.write('core_webservice_get_site_info', {})).rejects.toMatchObject({code: 'INTEGRATION_UNSUPPORTED'});
  await expect(client.write('mod_assign_save_submission', {assignmentid: 1, userid: 42})).rejects.toMatchObject({code: 'VALIDATION_ERROR'});
  expect(mock).not.toHaveBeenCalled();
});
it.each(['http://example.invalid/moodle/', 'https://user:password@example.invalid/moodle/', 'https://example.invalid/moodle/?token=other'])
  ('refuses unsafe upload base %s without a request', async baseUrl => {
    const mock = vi.fn<typeof fetch>();
    const client = new RestClient({baseUrl, token: 'fake', logger: createLogger('silent'), fetch: mock});
    await expect(client.upload({name: 'file.pdf', filename: 'file.pdf', size: 1, sha256: 'hash', bytes: new Uint8Array([1])}, 0))
      .rejects.toMatchObject({code: 'INTEGRATION_UNSUPPORTED'});
    expect(mock).not.toHaveBeenCalled();
  });
