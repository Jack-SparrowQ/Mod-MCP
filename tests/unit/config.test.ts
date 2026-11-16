import { expect, it } from 'vitest';
import { readConfig } from '../../src/shared/config.js';
it('defaults to token-free config', () => {
  expect(readConfig({})).toEqual({MOODLE_BASE_URL: 'https://moodle.itescam.edu.mx/moodle4/', LOG_LEVEL: 'info', MOODLE_TOKEN: undefined});
});
it('normalizes URL and blank token', () => {
  expect(readConfig({MOODLE_BASE_URL: 'https://example.invalid/moodle', MOODLE_TOKEN: '  '}))
    .toMatchObject({MOODLE_BASE_URL: 'https://example.invalid/moodle/', MOODLE_TOKEN: undefined});
});
it.each(['http://example.invalid/', 'https://user:password@example.invalid/', 'https://example.invalid/?token=secret', 'invalid'])
  ('rejects unsafe base URL without echoing it: %s', value => {
    expect(() => readConfig({MOODLE_BASE_URL: value})).toThrow('Invalid configuration. Check MOODLE_BASE_URL, MOODLE_TOKEN and LOG_LEVEL.');
  });
