import { z } from 'zod';

export const baseUrlSchema = z.string().url().refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}).transform(value => value.endsWith('/') ? value : `${value}/`);
const schema = z.object({
  MOODLE_BASE_URL: baseUrlSchema.default('https://moodle.itescam.edu.mx/moodle4/'),
  MOODLE_TOKEN: z.string().trim().optional().transform(value => value || undefined),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(env);
  // Never expose Zod issues: validation diagnostics may contain supplied values.
  if (!result.success) throw new Error('Invalid configuration. Check MOODLE_BASE_URL, MOODLE_TOKEN and LOG_LEVEL.');
  return result.data;
}
