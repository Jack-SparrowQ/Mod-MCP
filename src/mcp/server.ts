import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import { registerAuthStatus } from './tools/auth-status.js';
import { registerGetProfile } from './tools/get-profile.js';
import { registerGetCourses } from './tools/get-courses.js';
import { registerGetCourseContents } from './tools/get-course-contents.js';

export function createServer(adapter: MoodleAdapter) {
  const server = new McpServer({name: 'moodle-itescam-mcp', version: '0.1.0'});
  registerAuthStatus(server, adapter);
  registerGetProfile(server, adapter);
  registerGetCourses(server, adapter);
  registerGetCourseContents(server, adapter);
  return server;
}
