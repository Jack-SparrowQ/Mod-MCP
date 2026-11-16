import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import { getCalendarEvents } from '../../application/get-calendar-events.js';
import { readOnlyAnnotations, readTool } from './read-tool.js';

export function registerGetCalendarEvents(server: McpServer, adapter: MoodleAdapter) {
  server.registerTool('moodle_get_calendar_events', {
    description: 'List up to 200 calendar events in an ISO date range, default now through seven days later, maximum 92 days. Optionally restrict to an enrolled course; dates require an explicit timezone.',
    inputSchema: z.object({from: z.string().optional(), to: z.string().optional(), courseId: z.number().int().positive().optional()}).strict(),
    annotations: readOnlyAnnotations,
  }, async input => readTool(() => getCalendarEvents(adapter, input)));
}
