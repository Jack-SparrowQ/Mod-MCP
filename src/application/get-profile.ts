import type { MoodleAdapter } from '../domain/moodle-adapter.js';
export async function getProfile(adapter: MoodleAdapter) {
  return {profile: await adapter.getProfile()};
}
