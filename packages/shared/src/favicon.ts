import { isPublicFaviconHost } from "./hostClassification.ts";

function faviconUrlForPage(rawUrl: string | null | undefined, _size = 32): string | null {
  if (!rawUrl || rawUrl.length > 4096) return null;
  try {
    const pageUrl = new URL(rawUrl);
    if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") return null;
    return new URL("/favicon.ico", pageUrl.origin).href;
  } catch {
    return null;
  }
}

const THEMED_FAVICON_BY_HOSTNAME: Readonly<
  Record<string, Readonly<{ light: string; dark: string }>>
> = {
  "github.com": {
    light: "https://github.githubassets.com/favicons/favicon.svg",
    dark: "https://github.githubassets.com/favicons/favicon-dark.svg",
  },
};

function themedFaviconUrlForPage(
  rawUrl: string | null | undefined,
  appearance: "light" | "dark",
): string | null {
  if (!rawUrl || rawUrl.length > 4096) return null;
  try {
    const pageUrl = new URL(rawUrl);
    if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") return null;
    return THEMED_FAVICON_BY_HOSTNAME[pageUrl.hostname.toLowerCase()]?.[appearance] ?? null;
  } catch {
    return null;
  }
}

/** Accepts image URLs supplied by a provider event; `inlineOnly` keeps only data: URLs. */
function explicitFaviconUrl(rawUrl: string | null | undefined, inlineOnly = false): string | null {
  if (!rawUrl || rawUrl.length > 4096) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "data:") return url.href;
    if (inlineOnly) return null;
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * An icon an untrusted environment supplied, loadable only as inline data: a host name can
 * resolve to this machine and any URL can redirect there.
 */
export function inlineImageUrl(rawUrl: string | null | undefined): string | null {
  return explicitFaviconUrl(rawUrl, true);
}

export function toolActivityFaviconUrl(
  icon: {
    readonly pageUrl: string;
    readonly faviconUrl?: string | undefined;
    readonly faviconUrlDark?: string | undefined;
  },
  appearance: "light" | "dark",
  size = 32,
  untrusted = false,
): string | null {
  // An untrusted page's own host is never contacted; the favicon service looks it up instead.
  const pageFavicon = () =>
    untrusted ? faviconUrlForOrigin(icon.pageUrl, size) : faviconUrlForPage(icon.pageUrl, size);
  if (appearance === "dark") {
    return (
      explicitFaviconUrl(icon.faviconUrlDark, untrusted) ??
      themedFaviconUrlForPage(icon.pageUrl, "dark") ??
      explicitFaviconUrl(icon.faviconUrl, untrusted) ??
      pageFavicon()
    );
  }
  return (
    explicitFaviconUrl(icon.faviconUrl, untrusted) ??
    themedFaviconUrlForPage(icon.pageUrl, "light") ??
    pageFavicon()
  );
}

export function faviconUrlForOrigin(rawUrl: string | null | undefined, size = 32): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    if (!url.hostname) return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!isPublicFaviconHost(url.hostname)) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=${size}`;
  } catch {
    return null;
  }
}
