import { expect, it } from 'vitest';
import { readConfig } from '../../src/shared/config.js';
it('defaults to token-free config', () => {
  expect(readConfig({})).toEqual({MOODLE_BASE_URL: 'https://moodle.itescam.edu.mx/moodle4/', LOG_LEVEL: 'info', MOODLE_TOKEN: undefined, MAX_DOWNLOAD_MB: 50});
});
it('normalizes URL and blank token', () => {
  expect(readConfig({MOODLE_BASE_URL: 'https://example.invalid/moodle', MOODLE_TOKEN: '  '}))
    .toMatchObject({MOODLE_BASE_URL: 'https://example.invalid/moodle/', MOODLE_TOKEN: undefined});
});
it.each(['http://example.invalid/', 'https://user:password@example.invalid/', 'https://example.invalid/?token=secret', 'invalid'])
  ('rejects unsafe base URL without echoing it: %s', value => {
    expect(() => readConfig({MOODLE_BASE_URL: value})).toThrow('Invalid configuration. Check MOODLE_BASE_URL, MOODLE_TOKEN, LOG_LEVEL and MAX_DOWNLOAD_MB.');
  });
it.each(['0', '501', '1.5', 'invalid', ''])('rejects invalid MAX_DOWNLOAD_MB %j', value => {
  expect(() => readConfig({MAX_DOWNLOAD_MB: value})).toThrow('Invalid configuration.');
});
it.each(['1', '50', '500'])('accepts MAX_DOWNLOAD_MB %s', value => {
  expect(readConfig({MAX_DOWNLOAD_MB: value}).MAX_DOWNLOAD_MB).toBe(Number(value));
});
