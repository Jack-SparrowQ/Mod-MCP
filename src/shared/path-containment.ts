import { resolve, sep } from 'node:path';

function comparable(path: string) {
  const resolved = resolve(path);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
export function samePath(left: string, right: string): boolean { return comparable(left) === comparable(right); }
export function isWithinPath(root: string, path: string): boolean {
  const parent = comparable(root);
  const child = comparable(path);
  return child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
}
