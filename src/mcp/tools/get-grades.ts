import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import { getGrades } from '../../application/get-grades.js';
import { readOnlyAnnotations, readTool } from './read-tool.js';

export function registerGetGrades(server: McpServer, adapter: MoodleAdapter) {
  server.registerTool('moodle_get_grades', {
    description: 'Read your course grade overview, or grade items and course total for one enrolled course. Ungraded items are marked graded=false with grade=null. At most 200 items.',
    inputSchema: z.object({courseId: z.number().int().positive().optional()}).strict(),
    annotations: readOnlyAnnotations,
  }, async input => readTool(() => getGrades(adapter, input)));
}
