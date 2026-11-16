import { expect, it } from 'vitest';
import { resolve } from 'node:path';
import { sanitizeFilename, insideDirectory, suffixedFilename } from '../../src/shared/download-path.js';
it.each([
  ['../../x.pdf', 'x.pdf'], ['C:\\Windows\\a.txt', 'a.txt'], ['CON.txt', '_CON.txt'],
  ['nul', '_nul'], ['COM9.docx', '_COM9.docx'], ['LPT1', '_LPT1'], ['PRN.zip', '_PRN.zip'],
  ['a:*?"<>|\x00\x1f\x7f.txt', 'a.txt'], ['name.  ', 'name'], ['..', 'file'], ['', 'file'],
  ['a\u0085.txt', 'a.txt'],
])('sanitizes %j to %j', (input, output) => {
  expect(sanitizeFilename(input)).toBe(output);
});
it('caps names at 150 characters preserving a normal extension, including suffixes', () => {
  const name = sanitizeFilename('á'.repeat(200) + '.pdf');
  expect(Array.from(name)).toHaveLength(150);
  expect(name.endsWith('.pdf')).toBe(true);
  expect(Array.from(suffixedFilename(name, 1))).toHaveLength(150);
  expect(suffixedFilename(name, 1).endsWith(' (1).pdf')).toBe(true);
});
it('asserts resolved course-directory containment', () => {
  const directory = resolve('fixture-course-directory');
  expect(insideDirectory(directory, 'x.pdf')).toBe(resolve(directory, 'x.pdf'));
  expect(() => insideDirectory(directory, '../outside.pdf')).toThrow('Invalid operation parameters.');
  expect(() => insideDirectory(directory, '.')).toThrow('Invalid operation parameters.');
});
