import { handleAdminRequest } from './admin.js';
import { verifyAccessJwt } from './access.js';
import {
  ValidationError,
  validateContactMessage,
  validateCounterKey,
  validateGuestbook,
  validateMudScore,
  validateTokyoRecommendation,
} from './validation.js';

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean));
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins(env).has(origin)) return {};
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(request, env),
    },
  });
}

function requireAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins(env).has(origin)) {
    throw new Response('Origin not allowed.', { status: 403 });
  }
}

async function parseJsonBody(request) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 16_384) {
    throw new Response('Request body is too large.', { status: 413 });
  }
  try {
    return await request.json();
  } catch {
    throw new ValidationError('The request body must be valid JSON.');
  }
}

async function enforceRateLimit(limiter, key) {
  if (!limiter) return;
  const result = await limiter.limit({ key });
  if (!result.success) {
    throw new Response('Too many requests.', {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }
}

async function verifyTurnstile(body, request, env, fetcher) {
  const token = String(body.turnstileToken || '');
  if (!token) throw new ValidationError('Please complete the human verification.');
  if (!env.TURNSTILE_SECRET) throw new Error('TURNSTILE_SECRET is not configured.');
  const form = new FormData();
  form.set('secret', env.TURNSTILE_SECRET);
  form.set('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.set('remoteip', ip);
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  if (!response.ok) throw new Error(`Turnstile verification failed with ${response.status}.`);
  const result = await response.json();
  const hostnames = new Set(String(env.TURNSTILE_HOSTNAMES || '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean));
  if (!result.success || !hostnames.has(String(result.hostname || '').toLowerCase())) {
    throw new ValidationError('Human verification failed. Please try again.');
  }
}

async function insertGuestbook(db, value) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO guestbook_entries
      (id, name, country_code, country_name, comment, signed_at, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    value.id,
    value.name,
    value.countryCode,
    value.countryName,
    value.comment,
    value.signedAt,
    now,
  ).run();
}

async function insertTokyoRecommendation(db, value) {
  await db.prepare(`
    INSERT INTO tokyo_recommendations
      (id, name, recommendation, comment, submitted_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    value.id,
    value.name,
    value.recommendation,
    value.comment,
    value.submittedAt,
  ).run();
}

async function insertMudScore(db, value) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO mud_scores
      (id, name, moves, side_quests, side_quest_count, rank, route, completed_at, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    value.id,
    value.name,
    value.moves,
    JSON.stringify(value.sideQuests),
    value.sideQuestCount,
    value.rank,
    value.route,
    value.completedAt,
    now,
  ).run();
}

async function insertContactMessage(db, value) {
  await db.prepare(`
    INSERT INTO contact_messages
      (id, category, name, email, message, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    value.id,
    value.category,
    value.name,
    value.email,
    value.message,
    value.submittedAt,
  ).run();
}

async function publicContent(request, env, kind) {
  if (kind === 'guestbook') {
    const result = await env.DB.prepare(`
      SELECT id, name, country_code AS countryCode, country_name AS countryName,
             comment, signed_at AS signedAt, approved_at AS approvedAt, source
      FROM guestbook_entries
      WHERE status = 'approved'
      ORDER BY approved_at DESC, signed_at DESC
      LIMIT 100
    `).all();
    return json(request, env, { entries: result.results || [] });
  }
  if (kind === 'tokyo-recommendations') {
    const result = await env.DB.prepare(`
      SELECT id, name, recommendation, comment, submitted_at AS submittedAt,
             approved_at AS approvedAt, source
      FROM tokyo_recommendations
      WHERE status = 'approved'
      ORDER BY approved_at DESC, submitted_at DESC
      LIMIT 100
    `).all();
    return json(request, env, { entries: result.results || [] });
  }
  if (kind === 'mud-leaderboard') {
    const result = await env.DB.prepare(`
      SELECT id, name, moves, side_quests AS sideQuests, side_quest_count AS sideQuestCount,
             rank, route, completed_at AS completedAt, approved_at AS approvedAt, source
      FROM mud_scores
      WHERE status = 'approved'
      ORDER BY moves ASC, side_quest_count DESC, completed_at ASC
      LIMIT 100
    `).all();
    return json(request, env, {
      entries: (result.results || []).map((entry) => ({
        ...entry,
        sideQuests: JSON.parse(entry.sideQuests || '[]'),
      })),
    });
  }
  return json(request, env, { error: 'Not found.' }, 404);
}

async function submitContent(request, env, kind, deps) {
  requireAllowedOrigin(request, env);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  await enforceRateLimit(env.SUBMISSION_RATE_LIMITER, `${ip}:${kind}`);
  const body = await parseJsonBody(request);
  await verifyTurnstile(body, request, env, deps.fetch);
  if (kind === 'guestbook') {
    const value = validateGuestbook(body);
    await insertGuestbook(env.DB, value);
    return json(request, env, { id: value.id, status: 'pending' }, 202);
  }
  if (kind === 'tokyo-recommendation') {
    const value = validateTokyoRecommendation(body);
    await insertTokyoRecommendation(env.DB, value);
    return json(request, env, { id: value.id, status: 'pending' }, 202);
  }
  if (kind === 'mud-score') {
    const value = validateMudScore(body);
    await insertMudScore(env.DB, value);
    return json(request, env, { id: value.id, status: 'pending' }, 202);
  }
  return json(request, env, { error: 'Not found.' }, 404);
}

async function submitContact(request, env, deps) {
  requireAllowedOrigin(request, env);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  await enforceRateLimit(env.SUBMISSION_RATE_LIMITER, `${ip}:contact`);
  const body = await parseJsonBody(request);
  await verifyTurnstile(body, request, env, deps.fetch);
  const value = validateContactMessage(body);
  await insertContactMessage(env.DB, value);
  return json(request, env, { id: value.id, status: 'received' }, 202);
}

async function visitorKey(request, env, site, path) {
  if (!env.VISITOR_HASH_SALT) throw new Error('VISITOR_HASH_SALT is not configured.');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const bytes = new TextEncoder().encode(`${env.VISITOR_HASH_SALT}|${ip}|${userAgent}|${site}|${path}|${day}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function trackVisitor(request, env) {
  requireAllowedOrigin(request, env);
  const url = new URL(request.url);
  const { site, path } = validateCounterKey(url.searchParams.get('site'), url.searchParams.get('path'));
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  await enforceRateLimit(env.COUNTER_RATE_LIMITER, `${ip}:${site}:${path}`);
  const key = await visitorKey(request, env, site, path);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const seen = await env.DB.prepare(`
    INSERT OR IGNORE INTO page_view_visitors (visitor_key, site, path, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(key, site, path, expiresAt).run();
  if (seen.meta?.changes) {
    const now = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO page_views (site, path, views, updated_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(site, path) DO UPDATE SET
        views = page_views.views + 1,
        updated_at = excluded.updated_at
    `).bind(site, path, now).run();
  }
  return json(request, env, { success: true });
}

async function readVisitorCount(request, env) {
  const url = new URL(request.url);
  const { site, path } = validateCounterKey(url.searchParams.get('site'), url.searchParams.get('path'));
  const row = await env.DB.prepare(`
    SELECT views FROM page_views WHERE site = ? AND path = ?
  `).bind(site, path).first();
  return json(request, env, { views: Number(row?.views) || 0 });
}

export async function handleRequest(request, env, customDeps = {}) {
  const deps = {
    fetch: globalThis.fetch.bind(globalThis),
    verifyAccess: verifyAccessJwt,
    ...customDeps,
  };
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  try {
    if (url.pathname === '/health' && request.method === 'GET') {
      return json(request, env, { ok: true });
    }
    if (url.pathname.startsWith('/admin')) {
      const identity = await deps.verifyAccess(request, env);
      if (!identity) return json(request, env, { error: 'Cloudflare Access authentication required.' }, 403);
      return await handleAdminRequest(request, env, identity);
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/content/')) {
      return await publicContent(request, env, url.pathname.slice('/api/content/'.length));
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/submissions/')) {
      return await submitContent(request, env, url.pathname.slice('/api/submissions/'.length), deps);
    }
    if (request.method === 'POST' && url.pathname === '/api/contact') {
      return await submitContact(request, env, deps);
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/track') {
      return await trackVisitor(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/views') {
      return await readVisitorCount(request, env);
    }
    return json(request, env, { error: 'Not found.' }, 404);
  } catch (error) {
    if (error instanceof Response) {
      const headers = new Headers(error.headers);
      Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
      return new Response(error.body, { status: error.status, headers });
    }
    if (error instanceof ValidationError) {
      return json(request, env, { error: error.message }, 400);
    }
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      return json(request, env, { error: 'This submission was already received.' }, 409);
    }
    console.error(error);
    return json(request, env, { error: 'Internal server error.' }, 500);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
  async scheduled(_controller, env) {
    await env.DB.prepare(`
      DELETE FROM page_view_visitors WHERE expires_at < ?
    `).bind(new Date().toISOString()).run();
  },
};
