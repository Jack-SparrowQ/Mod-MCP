import { MoodleError } from '../domain/errors.js';

export async function readResult<T extends Record<string, unknown>>(operation: () => Promise<T>) {
  try { return {data: await operation(), isError: false}; }
  catch (error) {
    const safe = error instanceof MoodleError ? error : new MoodleError('OPERATION_FAILED');
    return {data: {error: {
      code: safe.code, message: safe.message, context: safe.context, suggestion: safe.suggestion,
    }}, isError: true};
  }
}
