import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import { authStatus } from '../../application/auth-status.js';

export function registerAuthStatus(server: McpServer, adapter: MoodleAdapter) {
  server.registerTool('moodle_auth_status', {
    description: 'Check whether the configured Moodle token is valid. Run npm run token to obtain one.',
    inputSchema: z.object({}).strict(),
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true},
  }, async () => {
    const {data, isError} = await authStatus(adapter);
    return {content: [{type: 'text' as const, text: JSON.stringify(data)}], structuredContent: data, isError};
  });
}
