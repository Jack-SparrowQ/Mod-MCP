import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import { registerAuthStatus } from './tools/auth-status.js';
import { registerGetProfile } from './tools/get-profile.js';
import { registerGetCourses } from './tools/get-courses.js';
import { registerGetCourseContents } from './tools/get-course-contents.js';
import { registerGetAssignments } from './tools/get-assignments.js';
import { registerGetAssignment } from './tools/get-assignment.js';
import { registerGetUpcomingDeadlines } from './tools/get-upcoming-deadlines.js';
import { registerGetCalendarEvents } from './tools/get-calendar-events.js';
import { registerGetGrades } from './tools/get-grades.js';
import { registerGetAnnouncements } from './tools/get-announcements.js';
import { registerDownloadResource } from './tools/download-resource.js';

export function createServer(adapter: MoodleAdapter) {
  const server = new McpServer({name: 'moodle-itescam-mcp', version: '0.1.0'});
  registerAuthStatus(server, adapter);
  registerGetProfile(server, adapter);
  registerGetCourses(server, adapter);
  registerGetCourseContents(server, adapter);
  registerGetAssignments(server, adapter);
  registerGetAssignment(server, adapter);
  registerGetUpcomingDeadlines(server, adapter);
  registerGetCalendarEvents(server, adapter);
  registerGetGrades(server, adapter);
  registerGetAnnouncements(server, adapter);
  registerDownloadResource(server, adapter);
  return server;
}
