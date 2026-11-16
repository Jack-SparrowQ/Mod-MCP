import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import { getUpcomingDeadlines } from '../../application/get-upcoming-deadlines.js';
import { readOnlyAnnotations, readTool } from './read-tool.js';

export function registerGetUpcomingDeadlines(server: McpServer, adapter: MoodleAdapter) {
  server.registerTool('moodle_get_upcoming_deadlines', {
    description: 'Get up to 200 action-calendar items still needing action, fetched in pages of 50. truncated=true means the collection cap was reached and more items may exist. Includes the last 30 days when includeOverdue is true; due dates are UTC. This is pending work, unlike the assignments list.',
    inputSchema: z.object({days: z.number().int().min(1).max(60).default(14), includeOverdue: z.boolean().default(true)}).strict(),
    annotations: readOnlyAnnotations,
  }, async input => readTool(() => getUpcomingDeadlines(adapter, input)));
}
