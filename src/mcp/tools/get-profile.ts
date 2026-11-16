import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import { getProfile } from '../../application/get-profile.js';
import { readOnlyAnnotations, readTool } from './read-tool.js';

export function registerGetProfile(server: McpServer, adapter: MoodleAdapter) {
  server.registerTool('moodle_get_profile', {
    description: 'Get only the authenticated student’s profile, including email when available. Takes no user ID.',
    inputSchema: z.object({}).strict(), annotations: readOnlyAnnotations,
  }, async () => readTool(() => getProfile(adapter)));
}
