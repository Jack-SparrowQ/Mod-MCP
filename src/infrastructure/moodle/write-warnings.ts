import { z } from 'zod';
import { MoodleError } from '../../domain/errors.js';
import { parseResponse } from './response-schemas.js';

export function checkWriteWarnings(data: unknown, redact: (value: string) => string): void {
  const warnings = z.array(z.object({warningcode: z.union([z.string(), z.number()])}));
  const parsed = parseResponse(z.union([warnings, z.object({warnings})]), data);
  const items = Array.isArray(parsed) ? parsed : parsed.warnings;
  if (items.length) throw new MoodleError('OPERATION_FAILED', 'Moodle reported submission warnings.', {
    warningcodes: items.map(item => redact(/^[a-z0-9_-]{1,80}$/i.test(String(item.warningcode)) ? String(item.warningcode) : 'unknown')).join(','),
  });
}
