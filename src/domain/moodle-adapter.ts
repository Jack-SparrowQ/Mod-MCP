export interface SiteInfo {
  release: string;
  version: string;
  sitename: string;
  lang: string;
}
export interface MoodleAdapter { getSiteInfo(): Promise<SiteInfo>; }
