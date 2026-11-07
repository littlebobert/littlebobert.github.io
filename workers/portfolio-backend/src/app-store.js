// Karui's current App Store release, for the Karui desk accessory on the home page: the version,
// when it came out, and its release notes, from the US storefront in English or the Japanese one
// in Japanese. Apple's lookup API needs no key, but browsers can't call it directly, so the
// Worker relays it. Cloudflare keeps Apple's answer for an hour.

export const KARUI_APP_ID = '6814134614';
const STOREFRONTS = { en: 'us', ja: 'jp' };
const CACHE_SECONDS = 60 * 60;
const MAX_NOTES = 6;
const MAX_NOTE_LENGTH = 500;

export function lookupUrl(language) {
  const country = STOREFRONTS[language] || STOREFRONTS.en;
  return `https://itunes.apple.com/lookup?id=${KARUI_APP_ID}&country=${country}`;
}

// The notes are paragraphs separated by blank lines; each paragraph is one item.
export function noteItems(releaseNotes) {
  return String(releaseNotes || '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, MAX_NOTES)
    .map((paragraph) => (paragraph.length > MAX_NOTE_LENGTH
      ? `${paragraph.slice(0, MAX_NOTE_LENGTH - 1).trimEnd()}…`
      : paragraph));
}

export async function karuiRelease(language, fetcher) {
  const response = await fetcher(lookupUrl(language), {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
  });
  if (!response.ok) throw new Error(`App Store lookup returned ${response.status}`);
  const app = (await response.json())?.results?.[0];
  if (!app?.version) throw new Error('App Store lookup has no Karui');
  return {
    version: String(app.version),
    releasedAt: app.currentVersionReleaseDate || null,
    notes: noteItems(app.releaseNotes),
  };
}
