import { expect, it } from 'vitest';
// Plain Node CLI intentionally remains JavaScript.
// @ts-expect-error no declaration needed for the local .mjs helper
import { upsertEnvLine } from '../../scripts/get-token.mjs';
it('adds token to empty text', () => {
  expect(upsertEnvLine('', 'MOODLE_TOKEN', 'fake')).toBe('MOODLE_TOKEN="fake"\n');
});
it('replaces an existing token and keeps other lines', () => {
  expect(upsertEnvLine('# comment\nMOODLE_TOKEN=old\nLOG_LEVEL=info\n', 'MOODLE_TOKEN', 'fake'))
    .toBe('# comment\nMOODLE_TOKEN="fake"\nLOG_LEVEL=info\n');
});
it('appends without losing a last line and preserves CRLF', () => {
  expect(upsertEnvLine('A=1\r\nB=2', 'MOODLE_TOKEN', 'fake')).toBe('A=1\r\nB=2\r\nMOODLE_TOKEN="fake"\r\n');
});
it('replaces exported entries and removes duplicates', () => {
  expect(upsertEnvLine('export MOODLE_TOKEN=old\nMOODLE_TOKEN=older\nX=1', 'MOODLE_TOKEN', 'fake'))
    .toBe('MOODLE_TOKEN="fake"\nX=1');
});
it('rejects newline injection', () => {
  expect(() => upsertEnvLine('', 'MOODLE_TOKEN', 'fake\nBAD=1')).toThrow('Invalid environment entry.');
});
