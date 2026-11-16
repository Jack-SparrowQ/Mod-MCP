import { MoodleError, type ErrorCode } from '../../domain/errors.js';
const mappings: Record<string, ErrorCode> = {
  invalidtoken: 'SESSION_EXPIRED', accessexception: 'PERMISSION_DENIED', nopermissions: 'PERMISSION_DENIED',
  requireloginerror: 'PERMISSION_DENIED', servicenotavailable: 'INTEGRATION_UNSUPPORTED',
  webservicesnotenabled: 'INTEGRATION_UNSUPPORTED', webserviceisdisabled: 'INTEGRATION_UNSUPPORTED',
};
export function moodleResponseError(data: unknown, redact: (value: string) => string): MoodleError | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const result = data as Record<string, unknown>;
  if (!result.errorcode && !result.exception && !result.error) return undefined;
  const raw = typeof result.errorcode === 'string' ? result.errorcode : 'unknown';
  const code = redact(/^[a-z][a-z0-9_]{0,79}$/.test(raw) ? raw : 'unknown');
  return new MoodleError(mappings[raw] ?? 'OPERATION_FAILED', undefined, {errorcode: code});
}
