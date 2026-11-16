import type { Logger } from 'pino';
import { MoodleError, type ErrorCode } from '../../domain/errors.js';
import { flattenParams, type MoodleParam } from './form-params.js';

export const ALLOWED_FUNCTIONS = [
  'core_webservice_get_site_info', 'core_user_get_users_by_field',
  'core_enrol_get_users_courses', 'core_course_get_contents',
  'mod_assign_get_assignments', 'mod_assign_get_submission_status',
  'core_calendar_get_action_events_by_timesort', 'core_calendar_get_calendar_events',
  'gradereport_overview_get_course_grades', 'gradereport_user_get_grade_items',
  'mod_forum_get_forums_by_courses', 'mod_forum_get_forum_discussions',
] as const;
const mappings: Record<string, ErrorCode> = {
  invalidtoken: 'SESSION_EXPIRED',
  accessexception: 'PERMISSION_DENIED', nopermissions: 'PERMISSION_DENIED',
  requireloginerror: 'PERMISSION_DENIED', servicenotavailable: 'INTEGRATION_UNSUPPORTED',
  webservicesnotenabled: 'INTEGRATION_UNSUPPORTED', webserviceisdisabled: 'INTEGRATION_UNSUPPORTED',
};
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

  async call(wsfunction: string, params: Record<string, MoodleParam> = {}): Promise<unknown> {
    const started = performance.now();
    let outcome: string = 'OK';
    const allowed = ALLOWED_FUNCTIONS.some(name => name === wsfunction);
    try {
      if (!allowed) throw new MoodleError('INTEGRATION_UNSUPPORTED');
      if (!this.options.token) throw new MoodleError('AUTH_REQUIRED');
      const reserved = ['wstoken', 'wsfunction', 'moodlewsrestformat'];
      if (Object.keys(params).some(key => reserved.includes(key))) throw new MoodleError('VALIDATION_ERROR');
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
      const result = data as Record<string, unknown>;
      if (result.errorcode || result.exception || result.error) {
        const rawCode = typeof result.errorcode === 'string' ? result.errorcode : 'unknown';
        const safeCode = this.redact(/^[a-z][a-z0-9_]{0,79}$/.test(rawCode) ? rawCode : 'unknown');
        throw new MoodleError(mappings[rawCode] ?? 'OPERATION_FAILED', undefined, {errorcode: safeCode});
      }
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
      });
    }
  }
}
