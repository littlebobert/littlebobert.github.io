// Speak desk accessory: visitors call a voice agent (ElevenLabs Agents) that answers questions
// about Justin, his apps, and Tokyo. The agent is private (signed URLs only), so the
// ELEVENLABS_API_KEY secret stays here and every call starts with this Worker. What protects the
// bill:
//   - Turnstile and SPEAK_RATE_LIMITER before a call is handed out,
//   - SPEAK_DAILY_CALLS calls a day across all visitors, counted in Japan time,
//   - the agent's own max_duration_seconds and daily call limit, set by
//     scripts/speak-agent.mjs, in case a signed URL is used somewhere unexpected.
const DEFAULT_DAILY_CALLS = 30;
const ELEVENLABS = 'https://api.elevenlabs.io';

const japanDay = (now = Date.now()) => new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

function dailyCalls(env) {
  const calls = Number(env.SPEAK_DAILY_CALLS);
  return Number.isFinite(calls) && calls >= 0 ? Math.floor(calls) : DEFAULT_DAILY_CALLS;
}

export function speakConfigured(env) {
  return Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_AGENT_ID);
}

export async function remainingCalls(env, now = Date.now()) {
  const row = await env.DB.prepare(`
    SELECT calls FROM speak_calls WHERE day = ?
  `).bind(japanDay(now)).first();
  return Math.max(0, dailyCalls(env) - (Number(row?.calls) || 0));
}

// Takes a call out of today's allowance before ElevenLabs is asked, atomically, so simultaneous
// requests can't overspend it. False if none are left.
export async function reserveCall(env, now = Date.now()) {
  const limit = dailyCalls(env);
  if (limit < 1) return false;
  const result = await env.DB.prepare(`
    INSERT INTO speak_calls (day, calls) VALUES (?, 1)
    ON CONFLICT(day) DO UPDATE SET calls = speak_calls.calls + 1
    WHERE speak_calls.calls < ?
  `).bind(japanDay(now), limit).run();
  return Boolean(result.meta?.changes);
}

export async function refundCall(env, now = Date.now()) {
  await env.DB.prepare(`
    UPDATE speak_calls SET calls = MAX(0, calls - 1) WHERE day = ?
  `).bind(japanDay(now)).run();
}

// A wss:// URL for one conversation. It has to be opened within 15 minutes; the call itself can
// run until the agent's max_duration_seconds.
export async function signedConversationUrl(env, fetcher) {
  const url = new URL('/v1/convai/conversation/get-signed-url', ELEVENLABS);
  url.searchParams.set('agent_id', env.ELEVENLABS_AGENT_ID);
  const response = await fetcher(url.toString(), {
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, Accept: 'application/json' },
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`ElevenLabs signed URL failed with ${response.status}: ${detail}`);
  }
  const { signed_url: signedUrl } = await response.json();
  if (!String(signedUrl || '').startsWith('wss://')) throw new Error('ElevenLabs returned no signed URL.');
  return signedUrl;
}
