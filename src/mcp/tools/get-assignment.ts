import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import { getAssignment } from '../../application/get-assignment.js';
import { readOnlyAnnotations, readTool } from './read-tool.js';

export function registerGetAssignment(server: McpServer, adapter: MoodleAdapter) {
  server.registerTool('moodle_get_assignment', {
    description: 'Get one assignment in your enrolled courses, its instructions, your submission state and available grade. Overdue means the due date passed and your submission is not submitted.',
    inputSchema: z.object({assignmentId: z.number().int().positive()}).strict(),
    annotations: readOnlyAnnotations,
  }, async ({assignmentId}) => readTool(() => getAssignment(adapter, assignmentId)));
}
