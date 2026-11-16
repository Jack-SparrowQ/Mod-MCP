import type { Logger } from 'pino';
import { MoodleError } from '../../domain/errors.js';
import { flattenParams, type MoodleParam } from './form-params.js';
import { downloadFile } from './file-download.js';
import { moodleResponseError } from './moodle-error.js';
import { uploadFile } from './upload.js';
import type { UploadFile } from '../../domain/submission.js';
import { checkWriteWarnings } from './write-warnings.js';

export const ALLOWED_FUNCTIONS = [
  'core_webservice_get_site_info', 'core_user_get_users_by_field',
  'core_enrol_get_users_courses', 'core_course_get_contents',
  'mod_assign_get_assignments', 'mod_assign_get_submission_status',
  'core_calendar_get_action_events_by_timesort', 'core_calendar_get_calendar_events',
  'gradereport_overview_get_course_grades', 'gradereport_user_get_grade_items',
  'mod_forum_get_forums_by_courses', 'mod_forum_get_forum_discussions',
] as const;
export const WRITE_FUNCTIONS = ['mod_assign_save_submission', 'mod_assign_submit_for_grading'] as const;
export class RestClient {
  constructor(private readonly options: {
    baseUrl: string; token?: string; logger: Logger; timeoutMs?: number; fetch?: typeof fetch;
  }) {}

  redact(value: string): string {
    return this.options.token ? value.split(this.options.token).join('[REDACTED]') : value;
  }

  siteUrl(path: string, params: Record<string, string>): string {
    const url = new URL(path, this.options.baseUrl);
    url.search = new URLSearchParams(params).toString();
    return this.redact(url.href);
  }

  download(fileUrl: string, destination: string, maxBytes: number, expectedSize?: number | null) {
    return downloadFile({fileUrl, destination, maxBytes, expectedSize,
      baseUrl: this.options.baseUrl, token: this.options.token, logger: this.options.logger, fetch: this.options.fetch});
  }

  upload(file: UploadFile, itemId: number) { return uploadFile(this.options, file, itemId); }

  call(wsfunction: string, params: Record<string, MoodleParam> = {}): Promise<unknown> {
    return this.request(wsfunction, params, false);
  }
  write(wsfunction: string, params: Record<string, MoodleParam>): Promise<unknown> {
    return this.request(wsfunction, params, true);
  }
  private async request(wsfunction: string, params: Record<string, MoodleParam>, write: boolean): Promise<unknown> {
    const started = performance.now();
    let outcome: string = 'OK';
    const allowed = write ? WRITE_FUNCTIONS.some(name => name === wsfunction) : ALLOWED_FUNCTIONS.some(name => name === wsfunction);
    try {
      if (!allowed) throw new MoodleError('INTEGRATION_UNSUPPORTED');
      if (!this.options.token) throw new MoodleError('AUTH_REQUIRED');
      const reserved = ['wstoken', 'wsfunction', 'moodlewsrestformat'];
      if (Object.keys(params).some(key => reserved.includes(key))) throw new MoodleError('VALIDATION_ERROR');
      if (write && 'userid' in params) throw new MoodleError('VALIDATION_ERROR');
      if ((wsfunction === 'mod_assign_get_submission_status' || wsfunction === 'gradereport_overview_get_course_grades') &&
        'userid' in params) throw new MoodleError('VALIDATION_ERROR');
      const body = flattenParams(params);
      body.set('wstoken', this.options.token);
      body.set('wsfunction', wsfunction);
      body.set('moodlewsrestformat', 'json');
      let data: unknown;
      try {
        const response = await (this.options.fetch ?? fetch)(new URL('webservice/rest/server.php', this.options.baseUrl), {
          method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(this.options.timeoutMs ?? 15000),
        });
        if (response.status >= 500) throw new MoodleError('MOODLE_UNAVAILABLE');
        if (!response.ok) throw new MoodleError('OPERATION_FAILED', undefined, {httpStatus: response.status});
        data = await response.json();
      } catch (error) {
        if (error instanceof MoodleError) throw error;
        throw new MoodleError('MOODLE_UNAVAILABLE');
      }
      if (!data || typeof data !== 'object') throw new MoodleError('OPERATION_FAILED');
      const error = moodleResponseError(data, value => this.redact(value));
      if (error) throw error;
      if (write) checkWriteWarnings(data, value => this.redact(value));
      return data;
    } catch (error) {
      const safe = error instanceof MoodleError ? error : new MoodleError('OPERATION_FAILED');
      outcome = safe.code;
      throw safe;
    } finally {
      // No user-provided function names, params, raw errors or URLs are logged.
      this.options.logger.info({
        function: allowed ? this.redact(wsfunction) : '[unsupported]',
        durationMs: Math.round(performance.now() - started), outcome,
        ...(write ? {bytes: 0} : {}),
      });
    }
  }
}
