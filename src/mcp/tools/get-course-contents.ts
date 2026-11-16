import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import { getCourseContents } from '../../application/get-course-contents.js';
import { readOnlyAnnotations, readTool } from './read-tool.js';

export function registerGetCourseContents(server: McpServer, adapter: MoodleAdapter) {
  server.registerTool('moodle_get_course_contents', {
    description: 'Get sections and activities for an enrolled course. Returns file metadata only, without download URLs. Use moodle_get_courses to find a courseId.',
    inputSchema: z.object({courseId: z.number().int().positive()}).strict(), annotations: readOnlyAnnotations,
  }, async ({courseId}) => readTool(() => getCourseContents(adapter, courseId)));
}
