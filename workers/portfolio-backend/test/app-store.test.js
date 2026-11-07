import assert from 'node:assert/strict';
import test from 'node:test';
import { noteItems } from '../src/app-store.js';
import { handleRequest } from '../src/index.js';

const ORIGIN = 'https://justin-garcia.pages.dev';

function environment(overrides = {}) {
  return {
    ALLOWED_ORIGINS: ORIGIN,
    ALLOWED_ORIGIN_SUFFIXES: '',
    COUNTER_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ...overrides,
  };
}

// Stands in for Apple's lookup API, and records which storefronts were asked.
function fakeAppStore({ status = 200, results } = {}) {
  const asked = [];
  const fetch = async (url) => {
    const href = new URL(String(url));
    assert.equal(href.origin, 'https://itunes.apple.com');
    asked.push(href.searchParams.get('country'));
    if (status !== 200) return new Response('nope', { status });
    const country = href.searchParams.get('country');
    return Response.json({
      resultCount: 1,
      results: results ?? [{
        version: '0.2.11',
        currentVersionReleaseDate: '2026-11-06T20:53:32Z',
        releaseNotes: country === 'jp'
          ? '自分の予定のリマインダーが必ず届くようになりました。\n\nMacで読んだ通知がiPhoneでも消えるようになりました。'
          : 'Reminders for your own events now always come through.\n\nAlerts you’ve read on your Mac\nnow clear on your iPhone.',
      }],
    });
  };
  return { fetch, asked };
}

function latest(env, deps, query = '') {
  return handleRequest(new Request(`https://portfolio-backend.example/api/v1/karui/latest${query}`, {
    headers: { Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.10' },
  }), env, deps);
}

test('Karui’s latest release comes from the storefront matching the language', async () => {
  const appStore = fakeAppStore();

  const english = await latest(environment(), appStore);
  assert.equal(english.status, 200);
  assert.equal(english.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.match(english.headers.get('Cache-Control'), /public/);
  assert.deepEqual(await english.json(), {
    language: 'en',
    version: '0.2.11',
    releasedAt: '2026-11-06T20:53:32Z',
    notes: [
      'Reminders for your own events now always come through.',
      'Alerts you’ve read on your Mac now clear on your iPhone.',
    ],
  });

  const japanese = await latest(environment(), appStore, '?lang=ja');
  assert.equal((await japanese.json()).notes[0], '自分の予定のリマインダーが必ず届くようになりました。');

  // Anything else is English.
  await latest(environment(), appStore, '?lang=xx');
  assert.deepEqual(appStore.asked, ['us', 'jp', 'us']);
});

test('Karui’s latest release reports the App Store being down, or missing the app', async () => {
  for (const appStore of [fakeAppStore({ status: 503 }), fakeAppStore({ results: [] })]) {
    const response = await latest(environment(), appStore);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('Karui’s latest release is rate limited', async () => {
  const env = environment({ COUNTER_RATE_LIMITER: { limit: async () => ({ success: false }) } });
  const response = await latest(env, fakeAppStore());
  assert.equal(response.status, 429);
});

test('release notes become at most six trimmed items', () => {
  assert.deepEqual(noteItems(''), []);
  assert.deepEqual(noteItems(null), []);
  assert.deepEqual(noteItems('  One\n\n\n  Two  \n \nThree'), ['One', 'Two', 'Three']);
  assert.equal(noteItems(Array.from({ length: 9 }, (_, index) => `Item ${index}`).join('\n\n')).length, 6);
  const long = noteItems('x'.repeat(800))[0];
  assert.equal(long.length, 500);
  assert.ok(long.endsWith('…'));
});
