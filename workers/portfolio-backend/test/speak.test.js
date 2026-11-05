import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/index.js';
import { createTestDatabase } from './sqlite-d1.js';

const ORIGIN = 'https://justin-garcia.pages.dev';
const SIGNED_URL = 'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_test&conversation_signature=abc';

function createEnvironment(overrides = {}) {
  const { database, d1 } = createTestDatabase();
  return {
    database,
    env: {
      ALLOWED_ORIGINS: ORIGIN,
      ALLOWED_ORIGIN_SUFFIXES: '',
      TURNSTILE_HOSTNAMES: 'justin-garcia.pages.dev',
      TURNSTILE_SECRET: 'test-secret',
      ELEVENLABS_API_KEY: 'test-key',
      ELEVENLABS_AGENT_ID: 'agent_test',
      SPEAK_DAILY_CALLS: '2',
      DB: d1,
      SPEAK_RATE_LIMITER: { limit: async () => ({ success: true }) },
      COUNTER_RATE_LIMITER: { limit: async () => ({ success: true }) },
      ...overrides,
    },
  };
}

// Stands in for Turnstile and ElevenLabs, and records what was asked of ElevenLabs.
function fakeServices({ turnstile = true, elevenLabsStatus = 200 } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.startsWith('https://challenges.cloudflare.com/')) {
      return Response.json({ success: turnstile, hostname: 'justin-garcia.pages.dev' });
    }
    if (href.startsWith('https://api.elevenlabs.io/')) {
      calls.push({ href, key: init.headers?.['xi-api-key'] });
      if (elevenLabsStatus !== 200) return new Response('nope', { status: elevenLabsStatus });
      return Response.json({ signed_url: SIGNED_URL });
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };
  return { fetch, calls };
}

function startCall(env, deps, { origin = ORIGIN, token = 'valid' } = {}) {
  return handleRequest(new Request('https://portfolio-backend.example/api/v1/speak/call', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
    body: JSON.stringify({ turnstileToken: token }),
  }), env, deps);
}

function status(env) {
  return handleRequest(new Request('https://portfolio-backend.example/api/v1/speak/status', {
    headers: { Origin: ORIGIN },
  }), env);
}

test('a verified visitor gets a signed URL for the private agent, and the key stays server-side', async () => {
  const { env } = createEnvironment();
  const services = fakeServices();
  const response = await startCall(env, services);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const body = await response.json();
  assert.deepEqual(body, { signedUrl: SIGNED_URL });
  assert.equal(JSON.stringify(body).includes('test-key'), false);
  assert.equal(services.calls.length, 1);
  assert.match(services.calls[0].href, /\/v1\/convai\/conversation\/get-signed-url\?agent_id=agent_test$/);
  assert.equal(services.calls[0].key, 'test-key');
});

test('calls stop at the daily allowance, and status says so', async () => {
  const { env } = createEnvironment();
  const services = fakeServices();
  assert.equal((await (await status(env)).json()).available, true);
  assert.equal((await startCall(env, services)).status, 200);
  assert.equal((await startCall(env, services)).status, 200);
  const third = await startCall(env, services);
  assert.equal(third.status, 429);
  assert.equal((await third.json()).code, 'busy');
  assert.equal(services.calls.length, 2);
  assert.equal((await (await status(env)).json()).available, false);
});

test('a failed ElevenLabs request gives the call back', async () => {
  const { env, database } = createEnvironment({ SPEAK_DAILY_CALLS: '1' });
  const failing = await startCall(env, fakeServices({ elevenLabsStatus: 500 }));
  assert.equal(failing.status, 502);
  assert.equal((await failing.json()).code, 'upstream');
  assert.equal(database.prepare('SELECT SUM(calls) AS calls FROM speak_calls').get().calls, 0);
  assert.equal((await startCall(env, fakeServices())).status, 200);
});

test('no call without Turnstile, from another site, or before the agent is set up', async () => {
  const { env } = createEnvironment();

  const services = fakeServices({ turnstile: false });
  assert.equal((await startCall(env, services)).status, 400);
  assert.equal((await startCall(env, fakeServices(), { token: '' })).status, 400);
  assert.equal((await startCall(env, fakeServices(), { origin: 'https://example.com' })).status, 403);
  assert.equal(services.calls.length, 0);

  const { env: unconfigured } = createEnvironment({ ELEVENLABS_AGENT_ID: '' });
  const resting = await startCall(unconfigured, fakeServices());
  assert.equal(resting.status, 503);
  assert.equal((await resting.json()).code, 'unavailable');
  assert.equal((await (await status(unconfigured)).json()).available, false);
});

test('the speak rate limit applies before anything else', async () => {
  const { env } = createEnvironment({ SPEAK_RATE_LIMITER: { limit: async () => ({ success: false }) } });
  const services = fakeServices();
  assert.equal((await startCall(env, services)).status, 429);
  assert.equal(services.calls.length, 0);
});
