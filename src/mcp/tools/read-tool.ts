import { readResult } from '../../application/read-result.js';

export const readOnlyAnnotations = {
  readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true,
};
export async function readTool<T extends Record<string, unknown>>(operation: () => Promise<T>) {
  const {data, isError} = await readResult(operation);
  return {content: [{type: 'text' as const, text: JSON.stringify(data)}], structuredContent: data, isError};
}
