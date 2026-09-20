import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/index.js';
import { createTestDatabase } from './sqlite-d1.js';

const ORIGIN = 'https://justin-garcia.pages.dev';

function createEnvironment() {
  const { database, d1 } = createTestDatabase();
  return {
    database,
    env: {
      ALLOWED_ORIGINS: ORIGIN,
      ALLOWED_ORIGIN_SUFFIXES: '.justin-garcia.pages.dev',
      TURNSTILE_HOSTNAMES: 'justin-garcia.pages.dev',
      TURNSTILE_SECRET: 'test-secret',
      VISITOR_HASH_SALT: 'test-salt',
      DB: d1,
      SUBMISSION_RATE_LIMITER: { limit: async () => ({ success: true }) },
      COUNTER_RATE_LIMITER: { limit: async () => ({ success: true }) },
    },
  };
}

const successfulTurnstile = async () => Response.json({
  success: true,
  hostname: 'justin-garcia.pages.dev',
});

function request(path, options = {}) {
  return new Request(`https://portfolio-backend.example${path}`, {
    ...options,
    headers: {
      Origin: ORIGIN,
      'CF-Connecting-IP': '203.0.113.10',
      'User-Agent': 'portfolio-test',
      ...(options.headers || {}),
    },
  });
}

test('guestbook submissions remain pending until an admin approves them', async () => {
  const { env } = createEnvironment();
  const response = await handleRequest(request('/api/submissions/guestbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      turnstileToken: 'valid',
      id: 'guest-1',
      name: 'Alice',
      countryCode: 'JP',
      countryName: 'Japan',
      comment: 'Hello',
      signedAt: '2026-07-10T00:00:00Z',
    }),
  }), env, { fetch: successfulTurnstile });
  assert.equal(response.status, 202);

  const beforeApproval = await handleRequest(request('/api/content/guestbook'), env);
  assert.deepEqual((await beforeApproval.json()).entries, []);

  const queue = await handleRequest(request('/admin/api/queue'), env, {
    verifyAccess: async () => ({ email: 'owner@example.com' }),
  });
  assert.equal((await queue.json()).guestbook.length, 1);

  const approval = await handleRequest(request('/admin/api/guestbook/guest-1/approve', {
    method: 'POST',
  }), env, {
    verifyAccess: async () => ({ email: 'owner@example.com' }),
  });
  assert.equal(approval.status, 200);

  const afterApproval = await handleRequest(request('/api/content/guestbook'), env);
  assert.equal((await afterApproval.json()).entries[0].id, 'guest-1');
});

test('Turnstile failures and untrusted origins reject submissions', async () => {
  const { env } = createEnvironment();
  const failedTurnstile = async () => Response.json({
    success: false,
    hostname: 'justin-garcia.pages.dev',
  });
  const body = JSON.stringify({
    turnstileToken: 'invalid',
    category: 'app-idea',
    message: 'Build this.',
  });
  const failed = await handleRequest(request('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }), env, { fetch: failedTurnstile });
  assert.equal(failed.status, 400);

  const untrusted = await handleRequest(new Request('https://portfolio-backend.example/api/contact', {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.example',
      'Content-Type': 'application/json',
    },
    body,
  }), env, { fetch: successfulTurnstile });
  assert.equal(untrusted.status, 403);
});

test('contact messages stay private and can be marked read', async () => {
  const { env } = createEnvironment();
  const submitted = await handleRequest(request('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      turnstileToken: 'valid',
      id: 'contact-1',
      category: 'running',
      name: 'Runner',
      email: 'runner@example.com',
      message: 'Run around Ueno?',
    }),
  }), env, { fetch: successfulTurnstile });
  assert.equal(submitted.status, 202);

  const queue = await handleRequest(request('/admin/api/queue'), env, {
    verifyAccess: async () => ({ email: 'owner@example.com' }),
  });
  assert.equal((await queue.json()).contacts[0].status, 'unread');

  const markedRead = await handleRequest(request('/admin/api/contact/contact-1/read', {
    method: 'POST',
  }), env, {
    verifyAccess: async () => ({ email: 'owner@example.com' }),
  });
  assert.equal(markedRead.status, 200);
});

test('visitor counting is atomic and deduplicated by daily visitor hash', async () => {
  const { env } = createEnvironment();
  const path = '/api/v1/track?site=justin-garcia.pages.dev&path=%2F';
  assert.equal((await handleRequest(request(path), env)).status, 200);
  assert.equal((await handleRequest(request(path), env)).status, 200);

  const secondVisitor = request(path, {
    headers: {
      Origin: ORIGIN,
      'CF-Connecting-IP': '203.0.113.11',
      'User-Agent': 'portfolio-test',
    },
  });
  assert.equal((await handleRequest(secondVisitor, env)).status, 200);

  const count = await handleRequest(request('/api/v1/views?site=justin-garcia.pages.dev&path=%2F'), env);
  assert.equal((await count.json()).views, 2);
});

test('product download clicks increment aggregate totals and appear in admin analytics', async () => {
  const { database, env } = createEnvironment();
  const endpoint = '/api/v1/product-click';
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ product: 'yubi', action: 'join-testflight' }),
  };

  assert.equal((await handleRequest(request(endpoint, options), env)).status, 200);
  assert.equal((await handleRequest(request(endpoint, options), env)).status, 200);

  const row = database.prepare(`
    SELECT product, action, clicks, first_clicked_at AS firstClickedAt,
           last_clicked_at AS lastClickedAt
    FROM product_clicks
  `).get();
  assert.equal(row.product, 'yubi');
  assert.equal(row.action, 'join-testflight');
  assert.equal(row.clicks, 2);
  assert.ok(Date.parse(row.firstClickedAt));
  assert.ok(Date.parse(row.lastClickedAt));
  assert.deepEqual(Object.keys(row).sort(), [
    'action',
    'clicks',
    'firstClickedAt',
    'lastClickedAt',
    'product',
  ]);

  const queue = await handleRequest(request('/admin/api/queue'), env, {
    verifyAccess: async () => ({ email: 'owner@example.com' }),
  });
  const analytics = (await queue.json()).productClicks;
  assert.equal(analytics.length, 1);
  assert.equal(analytics[0].clicks, 2);
});

test('product click tracking rejects untrusted origins and unknown actions', async () => {
  const { env } = createEnvironment();
  const invalidAction = await handleRequest(request('/api/v1/product-click', {
    method: 'POST',
    body: JSON.stringify({ product: 'yubi', action: 'download-macos' }),
  }), env);
  assert.equal(invalidAction.status, 400);

  const untrustedOrigin = await handleRequest(new Request(
    'https://portfolio-backend.example/api/v1/product-click',
    {
      method: 'POST',
      headers: {
        Origin: 'https://attacker.example',
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: JSON.stringify({ product: 'yubi', action: 'join-testflight' }),
    },
  ), env);
  assert.equal(untrustedOrigin.status, 403);
});

test('Karui production and preview origins can record TestFlight clicks', async () => {
  for (const origin of ['https://karui.jp', 'https://abc123.karui-9yt.pages.dev']) {
    const { database, env } = createEnvironment();
    env.ALLOWED_ORIGINS = `${env.ALLOWED_ORIGINS},https://karui.jp`;
    env.ALLOWED_ORIGIN_SUFFIXES = `${env.ALLOWED_ORIGIN_SUFFIXES},.karui-9yt.pages.dev`;

    const response = await handleRequest(new Request(
      'https://portfolio-backend.example/api/v1/product-click',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'text/plain;charset=UTF-8',
        },
        body: JSON.stringify({ product: 'karui', action: 'join-testflight' }),
      },
    ), env);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    const row = database.prepare(`
      SELECT product, action, clicks FROM product_clicks
    `).get();
    assert.equal(row.product, 'karui');
    assert.equal(row.action, 'join-testflight');
    assert.equal(row.clicks, 1);
  }
});

test('preview deployment origins are allowed but lookalike domains are not', async () => {
  const { env } = createEnvironment();
  const path = '/api/v1/track?site=justin-garcia.pages.dev&path=%2F';

  const preview = await handleRequest(new Request(`https://portfolio-backend.example${path}`, {
    headers: {
      Origin: 'https://a1b2c3d4.justin-garcia.pages.dev',
      'CF-Connecting-IP': '203.0.113.12',
      'User-Agent': 'portfolio-test',
    },
  }), env);
  assert.equal(preview.status, 200);
  assert.equal(
    preview.headers.get('Access-Control-Allow-Origin'),
    'https://a1b2c3d4.justin-garcia.pages.dev',
  );

  const lookalike = await handleRequest(new Request(`https://portfolio-backend.example${path}`, {
    headers: {
      Origin: 'https://eviljustin-garcia.pages.dev',
      'CF-Connecting-IP': '203.0.113.13',
      'User-Agent': 'portfolio-test',
    },
  }), env);
  assert.equal(lookalike.status, 403);

  const insecure = await handleRequest(new Request(`https://portfolio-backend.example${path}`, {
    headers: {
      Origin: 'http://a1b2c3d4.justin-garcia.pages.dev',
      'CF-Connecting-IP': '203.0.113.14',
      'User-Agent': 'portfolio-test',
    },
  }), env);
  assert.equal(insecure.status, 403);
});

test('admin dashboard renders product click summaries and a responsive table', async () => {
  const { env } = createEnvironment();
  const response = await handleRequest(request('/admin'), env, {
    verifyAccess: async () => ({ email: 'owner@example.com' }),
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Product download clicks/);
  assert.match(html, /Total clicks/);
  assert.match(html, /Active products/);
  assert.match(html, /Latest click/);
  assert.match(html, /analytics-table-wrap/);
  assert.match(html, /Download for macOS/);
  assert.match(html, /Join TestFlight/);
});

test('admin routes require a verified Cloudflare Access identity', async () => {
  const { env } = createEnvironment();
  const response = await handleRequest(request('/admin'), env, {
    verifyAccess: async () => null,
  });
  assert.equal(response.status, 403);
});
