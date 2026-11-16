import { extname, resolve, sep } from 'node:path';
import { MoodleError } from '../domain/errors.js';

export function sanitizeFilename(value: string): string {
  let name = value.replace(/\\/g, '/').split('/').pop()!
    .replace(/[\/\\:*?"<>|\x00-\x1f\x7f-\x9f]/g, '').replace(/[. ]+$/g, '');
  if (!name) name = 'file';
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
  const extension = extname(name);
  const chars = Array.from(name);
  if (chars.length > 150) {
    const suffix = Array.from(extension).slice(0, 149).join('');
    name = chars.slice(0, 150 - Array.from(suffix).length).join('') + suffix;
  }
  return name;
}
export function insideDirectory(directory: string, filename: string): string {
  const root = resolve(directory);
  const path = resolve(root, filename);
  if (!path.startsWith(root + sep)) throw new MoodleError('VALIDATION_ERROR');
  return path;
}
export function suffixedFilename(name: string, count: number): string {
  if (!count) return name;
  const originalExtension = extname(name);
  const suffix = ` (${count})`;
  const extension = Array.from(originalExtension).slice(0, Math.max(0, 149 - suffix.length)).join('');
  const stem = Array.from(name.slice(0, name.length - originalExtension.length));
  return `${stem.slice(0, Math.max(1, 150 - Array.from(extension).length - suffix.length)).join('')}${suffix}${extension}`;
}
