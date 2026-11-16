import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import { getAnnouncements } from '../../application/get-announcements.js';
import { readOnlyAnnotations, readTool } from './read-tool.js';

export function registerGetAnnouncements(server: McpServer, adapter: MoodleAdapter) {
  server.registerTool('moodle_get_announcements', {
    description: 'Read recent announcements from news forums only in enrolled courses. Includes message text and author, newest modification first. At most 50 results; does not mark anything viewed.',
    inputSchema: z.object({courseId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(50).default(10)}).strict(),
    annotations: readOnlyAnnotations,
  }, async input => readTool(() => getAnnouncements(adapter, input)));
}
