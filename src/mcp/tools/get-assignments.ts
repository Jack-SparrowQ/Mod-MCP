import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import { getAssignments } from '../../application/get-assignments.js';
import { readOnlyAnnotations, readTool } from './read-tool.js';

export function registerGetAssignments(server: McpServer, adapter: MoodleAdapter) {
  server.registerTool('moodle_get_assignments', {
    description: 'List assignments in enrolled courses, optionally by course and ISO due-date bounds. Upcoming due dates first (soonest first), then past-due dates (most recent first), then no due date. Dates only: past_due does not imply an unsubmitted task. Use moodle_get_upcoming_deadlines for pending work. At most 200 results; no submission status calls.',
    inputSchema: z.object({courseId: z.number().int().positive().optional(), dueAfter: z.string().optional(), dueBefore: z.string().optional(), limit: z.number().int().min(1).max(200).default(50)}).strict(),
    annotations: readOnlyAnnotations,
  }, async input => readTool(() => getAssignments(adapter, input)));
}
