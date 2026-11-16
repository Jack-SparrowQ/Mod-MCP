import { expect, it } from 'vitest';
import { htmlToText, unixToIso } from '../../src/shared/moodle-values.js';

it('strips markup/comments/scripts, decodes common and numeric entities and collapses whitespace', () => {
  expect(htmlToText('<p>Hola&nbsp;&amp; adi&oacute;s</p>\n<br> &quot;texto&quot; &#241; &#xE1; <!-- hidden --> <script>hidden()</script>'))
    .toBe('Hola & adiós "texto" ñ á');
});
it('keeps unknown/invalid entities as text and does not reinterpret decoded markup', () => {
  expect(htmlToText('&lt;b&gt; &unknown; &#999999999;')).toBe('<b> &unknown; &#999999999;');
});
it('truncates at 500 characters including the ellipsis without splitting surrogate pairs', () => {
  expect(htmlToText('a'.repeat(500))).toBe('a'.repeat(500));
  expect(htmlToText('😀'.repeat(501))).toBe('😀'.repeat(499) + '…');
});
it('converts unix seconds to UTC ISO dates', () => {
  expect(unixToIso(1704067200)).toBe('2024-01-01T00:00:00.000Z');
});
it.each([0, undefined, null])('maps absent/zero timestamp %s to null', value => {
  expect(unixToIso(value)).toBeNull();
});
it.each([-1, NaN, Infinity, 1e20])('rejects invalid timestamp %s', value => {
  expect(() => unixToIso(value)).toThrow('The Moodle operation failed.');
});
