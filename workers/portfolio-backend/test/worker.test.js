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

test('admin routes require a verified Cloudflare Access identity', async () => {
  const { env } = createEnvironment();
  const response = await handleRequest(request('/admin'), env, {
    verifyAccess: async () => null,
  });
  assert.equal(response.status, 403);
});
