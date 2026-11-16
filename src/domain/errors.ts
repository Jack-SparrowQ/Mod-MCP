export const errorCodes = [
  'AUTH_REQUIRED', 'AUTH_FAILED', 'SESSION_EXPIRED', 'MOODLE_UNAVAILABLE',
  'RESOURCE_NOT_FOUND', 'PERMISSION_DENIED', 'VALIDATION_ERROR', 'OPERATION_FAILED',
  'CONFIRMATION_REQUIRED', 'INTEGRATION_UNSUPPORTED',
] as const;
export type ErrorCode = typeof errorCodes[number];
const messages: Record<ErrorCode, string> = {
  AUTH_REQUIRED: 'A Moodle token is required.', AUTH_FAILED: 'Authentication failed.',
  SESSION_EXPIRED: 'The Moodle token is invalid or expired.',
  MOODLE_UNAVAILABLE: 'Moodle is currently unavailable.', RESOURCE_NOT_FOUND: 'Resource not found.',
  PERMISSION_DENIED: 'Moodle denied access to this operation.',
  VALIDATION_ERROR: 'Invalid operation parameters.', OPERATION_FAILED: 'The Moodle operation failed.',
  CONFIRMATION_REQUIRED: 'Explicit confirmation is required.',
  INTEGRATION_UNSUPPORTED: 'This Moodle integration operation is unavailable.',
};
export class MoodleError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message = messages[code],
    public readonly context: Record<string, string | number | boolean> = {},
    public readonly suggestion = code === 'AUTH_REQUIRED' || code === 'SESSION_EXPIRED'
      ? 'Run npm run token' : 'Check Moodle availability and account permissions, then try again.',
  ) { super(message); this.name = 'MoodleError'; }
}
