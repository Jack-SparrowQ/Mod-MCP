import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import { getCourses } from '../../application/get-courses.js';
import { readOnlyAnnotations, readTool } from './read-tool.js';

export function registerGetCourses(server: McpServer, adapter: MoodleAdapter) {
  server.registerTool('moodle_get_courses', {
    description: 'List your enrolled courses. Optionally filter names with an accent- and case-insensitive query, or select one enrolled course by courseId. Both filters can be combined.',
    inputSchema: z.object({query: z.string().trim().min(1).max(100).optional(), courseId: z.number().int().positive().optional()}).strict(),
    annotations: readOnlyAnnotations,
  }, async input => readTool(() => getCourses(adapter, input)));
}
