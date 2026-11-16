import { MoodleError } from '../../domain/errors.js';
import type { MoodleAdapter, SiteInfo } from '../../domain/moodle-adapter.js';
import type { RestClient } from './rest-client.js';

export class RestAdapter implements MoodleAdapter {
  constructor(private readonly client: RestClient) {}
  async getSiteInfo(): Promise<SiteInfo> {
    const data = await this.client.call('core_webservice_get_site_info') as Record<string, unknown>;
    const keys = ['release', 'version', 'sitename', 'lang'] as const;
    if (keys.some(key => typeof data[key] !== 'string')) throw new MoodleError('OPERATION_FAILED');
    return Object.fromEntries(keys.map(key => [key, this.client.redact(data[key] as string)])) as unknown as SiteInfo;
  }
}
