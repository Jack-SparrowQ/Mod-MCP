export function activityUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password ||
      !/\/mod\/[a-z][a-z0-9_]*\/view\.php$/.test(url.pathname) ||
      [...url.searchParams.keys()].some(key => /token|sesskey/i.test(key))) return undefined;
    return url.href;
  } catch { return undefined; }
}
