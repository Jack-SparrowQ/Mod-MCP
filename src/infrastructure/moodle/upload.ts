import { z } from 'zod';
import type { Logger } from 'pino';
import type { UploadFile } from '../../domain/submission.js';
import { MoodleError } from '../../domain/errors.js';
import { parseResponse, idSchema } from './response-schemas.js';
import { moodleResponseError } from './moodle-error.js';

export async function uploadFile(options: {baseUrl: string; token?: string; fetch?: typeof fetch; logger: Logger}, file: UploadFile, itemId: number) {
  const started = performance.now();
  let outcome = 'OK';
  try {
    if (!options.token) throw new MoodleError('AUTH_REQUIRED');
    if (!Number.isSafeInteger(itemId) || itemId < 0) throw new MoodleError('VALIDATION_ERROR');
    const base = new URL(options.baseUrl);
    const url = new URL('webservice/upload.php', base);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || url.origin !== base.origin) throw new MoodleError('INTEGRATION_UNSUPPORTED');
    const body = new FormData();
    body.set('token', options.token); body.set('filearea', 'draft'); body.set('itemid', String(itemId));
    body.set('file_1', new Blob([new Uint8Array(file.bytes)], {type: 'application/octet-stream'}), file.filename);
    let data: unknown;
    try {
      const response = await (options.fetch ?? fetch)(url, {method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(120000)});
      if (response.status >= 500) throw new MoodleError('MOODLE_UNAVAILABLE');
      if (response.status === 401 || response.status === 403) throw new MoodleError('PERMISSION_DENIED');
      if (!response.ok) throw new MoodleError('OPERATION_FAILED');
      data = await response.json();
    } catch (error) {
      if (error instanceof MoodleError) throw error;
      throw new MoodleError('MOODLE_UNAVAILABLE');
    }
    const error = moodleResponseError(data, value => value.split(options.token!).join('[REDACTED]'));
    if (error) throw error;
    const files = parseResponse(z.array(z.object({itemid: idSchema, filename: z.string()})).length(1), data);
    if (files[0].filename !== file.filename || (itemId !== 0 && files[0].itemid !== itemId)) throw new MoodleError('OPERATION_FAILED');
    return files[0].itemid;
  } catch (error) {
    const safe = error instanceof MoodleError ? error : new MoodleError('OPERATION_FAILED');
    outcome = safe.code;
    throw safe;
  } finally {
    options.logger.info({function: 'upload', durationMs: Math.round(performance.now() - started), outcome, bytes: file.size});
  }
}
