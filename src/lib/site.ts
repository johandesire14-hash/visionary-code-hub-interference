export const SITE_URL = (
  import.meta.env["VITE_SITE_URL"] ||
  import.meta.env["SITE_URL"] ||
  ""
).replace(/\/$/, "");

export function siteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return SITE_URL ? `${SITE_URL}${normalizedPath}` : normalizedPath;
}

export function hasConfiguredSiteUrl(): boolean {
  return Boolean(SITE_URL);
}
