import { MoodleError } from '../../domain/errors.js';

export type MoodleParam = string | number | boolean | MoodleParam[] | {[key: string]: MoodleParam};
export function flattenParams(params: Record<string, MoodleParam>): URLSearchParams {
  const result = new URLSearchParams();
  const ancestors = new Set<object>();
  function append(key: string, value: MoodleParam, depth: number) {
    if (depth > 30) throw new MoodleError('VALIDATION_ERROR');
    if (typeof value === 'boolean') result.append(key, value ? '1' : '0');
    else if (typeof value === 'string') result.append(key, value);
    else if (typeof value === 'number' && Number.isFinite(value)) result.append(key, String(value));
    else if (value && typeof value === 'object') {
      if (ancestors.has(value)) throw new MoodleError('VALIDATION_ERROR');
      ancestors.add(value);
      for (const [child, nested] of Object.entries(value)) {
        if (!/^[a-zA-Z0-9_]+$/.test(child)) throw new MoodleError('VALIDATION_ERROR');
        append(`${key}[${child}]`, nested, depth + 1);
      }
      ancestors.delete(value);
    } else throw new MoodleError('VALIDATION_ERROR');
  }
  for (const [key, value] of Object.entries(params)) {
    if (!/^[a-zA-Z0-9_]+$/.test(key)) throw new MoodleError('VALIDATION_ERROR');
    append(key, value, 0);
  }
  return result;
}
