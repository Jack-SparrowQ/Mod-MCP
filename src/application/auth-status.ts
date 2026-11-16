import { MoodleError } from '../domain/errors.js';
import type { MoodleAdapter } from '../domain/moodle-adapter.js';

export async function authStatus(adapter: MoodleAdapter) {
  try {
    const {sitename, release, version, lang} = await adapter.getSiteInfo();
    return {data: {authenticated: true, site: {sitename, release, version, lang}}, isError: false};
  } catch (error) {
    const safe = error instanceof MoodleError ? error : new MoodleError('OPERATION_FAILED');
    if (safe.code === 'AUTH_REQUIRED' || safe.code === 'SESSION_EXPIRED') {
      return {data: {authenticated: false, error: {
        code: safe.code, message: safe.message, suggestion: 'Run npm run token',
      }}, isError: false};
    }
    return {data: {error: {
      code: safe.code, message: safe.message, context: safe.context, suggestion: safe.suggestion,
    }}, isError: true};
  }
}
