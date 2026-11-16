import { MoodleError } from '../../domain/errors.js';
import type { MoodleAdapter, SiteInfo, UserProfile, Course, CourseSection, CourseFile } from '../../domain/moodle-adapter.js';
import { htmlToText, unixToIso } from '../../shared/moodle-values.js';
import type { RestClient } from './rest-client.js';
import {
  parseResponse, idSchema, siteSchema, identitySchema, emailSchema, coursesSchema,
  sectionsSchema, contentSchema, fileSchema,
} from './response-schemas.js';

export class RestAdapter implements MoodleAdapter {
  private ownUserId?: number;
  private pendingSiteInfo?: Promise<unknown>;
  constructor(private readonly client: RestClient) {}

  // Only userid persists. Concurrent callers share an in-flight request, not a data cache.
  private async loadSiteInfo(): Promise<unknown> {
    if (!this.pendingSiteInfo) this.pendingSiteInfo = this.client.call('core_webservice_get_site_info');
    const pending = this.pendingSiteInfo;
    try {
      const data = await pending;
      if (data && typeof data === 'object' && 'userid' in data) {
        const id = parseResponse(idSchema, data.userid);
        if (this.ownUserId !== undefined && this.ownUserId !== id) throw new MoodleError('OPERATION_FAILED');
        this.ownUserId = id;
      }
      return data;
    } finally {
      if (this.pendingSiteInfo === pending) this.pendingSiteInfo = undefined;
    }
  }
  private async getOwnUserId(): Promise<number> {
    if (this.ownUserId === undefined) {
      const data = await this.loadSiteInfo();
      if (!data || typeof data !== 'object' || !('userid' in data)) throw new MoodleError('OPERATION_FAILED');
      this.ownUserId = parseResponse(idSchema, data.userid);
    }
    return this.ownUserId;
  }

  async getSiteInfo(): Promise<SiteInfo> {
    const data = parseResponse(siteSchema, await this.loadSiteInfo());
    return {
      release: this.client.redact(data.release), version: this.client.redact(data.version),
      sitename: this.client.redact(data.sitename), lang: this.client.redact(data.lang),
    };
  }

  async getProfile(): Promise<UserProfile> {
    const data = parseResponse(identitySchema, await this.loadSiteInfo());
    const users = parseResponse(emailSchema, await this.client.call('core_user_get_users_by_field', {
      field: 'id', values: [data.userid],
    }));
    // A surprising response must never expose another student's profile/email.
    if (users.length > 1 || users.some(user => user.id !== data.userid)) throw new MoodleError('OPERATION_FAILED');
    const email = users[0]?.email;
    return {
      id: data.userid, fullname: this.client.redact(data.fullname),
      ...(data.username != null ? {username: this.client.redact(data.username)} : {}),
      ...(email != null ? {email: this.client.redact(email)} : {}),
      profileUrl: this.client.siteUrl('user/profile.php', {id: String(data.userid)}),
    };
  }

  async getCourses(): Promise<Course[]> {
    const userid = await this.getOwnUserId();
    const courses = parseResponse(coursesSchema, await this.client.call('core_enrol_get_users_courses', {userid}));
    return courses.map(course => ({
      id: course.id, shortname: this.client.redact(course.shortname), fullname: this.client.redact(course.fullname),
      summary: course.summary == null ? null : htmlToText(this.client.redact(course.summary)),
      ...(course.category != null ? {category: course.category} : {}),
      startDate: unixToIso(course.startdate), endDate: unixToIso(course.enddate),
      visible: course.visible == null ? null : Boolean(course.visible),
      ...(course.progress !== undefined ? {progress: course.progress} : {}),
      ...(course.lastaccess !== undefined ? {lastAccess: unixToIso(course.lastaccess)} : {}),
      url: this.client.siteUrl('course/view.php', {id: String(course.id)}),
    }));
  }

  private moduleUrl(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    try {
      const url = new URL(value);
      // Return activity pages only, never direct download/pluginfile URLs or token links.
      if (url.protocol !== 'https:' || url.username || url.password ||
        !/\/mod\/[a-z][a-z0-9_]*\/view\.php$/.test(url.pathname) ||
        [...url.searchParams.keys()].some(key => /token|sesskey/i.test(key))) return undefined;
      return this.client.redact(url.href);
    } catch { return undefined; }
  }

  async getCourseContents(courseId: number): Promise<CourseSection[]> {
    parseResponse(idSchema, courseId);
    const sections = parseResponse(sectionsSchema, await this.client.call('core_course_get_contents', {courseid: courseId}));
    return sections.map(section => ({
      id: section.id, number: section.section ?? null, name: this.client.redact(section.name),
      summary: section.summary == null ? null : htmlToText(this.client.redact(section.summary)),
      visible: section.visible == null ? null : Boolean(section.visible),
      modules: section.modules.map(module => {
        const url = this.moduleUrl(module.url);
        const availability = module.availabilityinfo ?? module.availability;
        const files = module.contents?.flatMap(content => {
          if (parseResponse(contentSchema, content).type !== 'file') return [];
          const file = parseResponse(fileSchema, content);
          const metadata: CourseFile = {
            filename: this.client.redact(file.filename), size: file.filesize ?? null,
            mimeType: file.mimetype == null ? null : this.client.redact(file.mimetype),
            modifiedAt: unixToIso(file.timemodified),
          };
          return [metadata];
        });
        return {
          id: module.id, name: this.client.redact(module.name), type: this.client.redact(module.modname),
          ...(url ? {url} : {}), visible: module.visible == null ? null : Boolean(module.visible),
          ...(availability != null ? {availability: htmlToText(this.client.redact(availability))} : {}),
          ...(files !== undefined ? {files} : {}),
        };
      }),
    }));
  }
}
