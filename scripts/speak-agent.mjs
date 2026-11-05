// Creates or updates Speak's voice agent on ElevenLabs, from files in this repo, so the agent's
// instructions and knowledge are versioned with the site.
//
//   ELEVENLABS_API_KEY=… node scripts/speak-agent.mjs [--voice Jessica] [--llm <model>] [--dry-run]
//
// The key can also go in .env.local (ignored by git). The first run creates a private agent and
// writes its ID into workers/portfolio-backend/wrangler.jsonc; later runs update that agent.
// Deploy the Worker afterwards so it hands out calls to it.
//
// The system prompt is scripts/speak-agent-prompt.md followed by what the site already says:
// llms.txt and each app's *-llms.txt, the resume, and the approved Tokyo recommendations.
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WRANGLER = path.join(ROOT, 'workers/portfolio-backend/wrangler.jsonc');
const API = 'https://api.elevenlabs.io';

// Matches the Worker's SPEAK_DAILY_CALLS and the Speak window's 2:00 timer.
const MAX_CALL_SECONDS = 120;
const DAILY_CALLS = 30;

const FIRST_MESSAGES = {
  en: 'Hi, you’ve reached Justin’s desk. Ask me about him, his apps, or Tokyo.',
  ja: 'はい、ジャスティンのデスクです。本人のこと、アプリのこと、東京のこと、なんでも聞いてください。',
};

function option(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}
const dryRun = process.argv.includes('--dry-run');

async function loadLocalEnv() {
  try {
    const contents = await fs.readFile(path.join(ROOT, '.env.local'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

// --- Knowledge, from the site itself.

function htmlToText(html) {
  return html
    .replace(/<(script|style|head|nav)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Japanese labels live in attributes for the language switch; the English text is enough.
    .replace(/\sdata-label-[a-z-]+="[^"]*"/gi, '')
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;/g, '’')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

async function knowledge() {
  const files = (await fs.readdir(ROOT)).filter((name) => /^([a-z]+-)?llms\.txt$/.test(name)).sort();
  const sections = [];
  for (const name of files) {
    sections.push(`## From ${name}\n\n${(await fs.readFile(path.join(ROOT, name), 'utf8')).trim()}`);
  }
  const resume = htmlToText(await fs.readFile(path.join(ROOT, 'resume.html'), 'utf8'));
  sections.push(`## Justin's resume\n\n${resume}`);
  const { entries = [] } = JSON.parse(await fs.readFile(path.join(ROOT, 'data/tokyo-recommendations.json'), 'utf8'));
  const tips = entries
    .filter((entry) => entry.approvedAt)
    .map((entry) => `- ${entry.recommendation}${entry.comment ? ` (${entry.comment})` : ''}, from ${entry.name}`);
  if (tips.length) sections.push(`## Tokyo recommendations from the site's visitors and Justin\n\n${tips.join('\n')}`);
  return sections.join('\n\n');
}

async function systemPrompt() {
  const persona = (await fs.readFile(path.join(ROOT, 'scripts/speak-agent-prompt.md'), 'utf8')).trim();
  return `${persona}\n\n${await knowledge()}\n`;
}

// --- ElevenLabs.

async function elevenLabs(pathname, init = {}) {
  const response = await fetch(new URL(pathname, API), {
    ...init,
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${pathname} failed with ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// Only ElevenLabs' own stock voices, never a clone.
async function stockVoice(name) {
  const result = await elevenLabs('/v2/voices?category=premade&page_size=100');
  const voices = (result.voices || []).filter((voice) => voice.category === 'premade');
  const voice = voices.find((entry) => entry.name.toLowerCase().startsWith(name.toLowerCase()));
  if (!voice) {
    const names = voices.map((entry) => entry.name).sort().join(', ');
    throw new Error(`No stock voice named “${name}”. Stock voices: ${names}`);
  }
  return voice;
}

function agentBody({ prompt, voiceId, llm }) {
  return {
    name: 'Speak (onemorething.tokyo)',
    conversation_config: {
      agent: {
        first_message: FIRST_MESSAGES.en,
        language: 'en',
        prompt: { prompt, ...(llm ? { llm } : {}) },
      },
      // ElevenLabs requires an English-only model for an English agent; Japanese calls switch to
      // the multilingual Flash v2.5 through their language preset below.
      tts: { voice_id: voiceId, model_id: 'eleven_flash_v2' },
      conversation: { max_duration_seconds: MAX_CALL_SECONDS },
      // The Speak window asks for Japanese when the site is in Japanese.
      language_presets: {
        ja: {
          overrides: {
            agent: { language: 'ja', first_message: FIRST_MESSAGES.ja },
            tts: { model_id: 'eleven_flash_v2_5' },
          },
        },
      },
    },
    platform_settings: {
      // Private: a call needs a signed URL from the Worker, which checks Turnstile and the daily
      // allowance first. The agent ID alone isn't enough.
      auth: { enable_auth: true },
      call_limits: { daily_limit: DAILY_CALLS, agent_concurrency_limit: 3 },
      // No recordings of visitors' voices. Transcripts stay 30 days, to see what people ask.
      privacy: { record_voice: false, retention_days: 30 },
      // The Speak window picks English or Japanese and can switch a call to typing. Nothing else
      // about the agent can be changed from the browser.
      overrides: {
        conversation_config_override: {
          agent: { first_message: true, language: true },
          conversation: { text_only: true },
        },
      },
    },
  };
}

async function readAgentId() {
  const config = await fs.readFile(WRANGLER, 'utf8');
  return config.match(/"ELEVENLABS_AGENT_ID":\s*"([^"]*)"/)?.[1] || '';
}

async function writeAgentId(agentId) {
  const config = await fs.readFile(WRANGLER, 'utf8');
  const updated = config.replace(/("ELEVENLABS_AGENT_ID":\s*)"[^"]*"/, `$1"${agentId}"`);
  if (updated === config) throw new Error(`Couldn't find ELEVENLABS_AGENT_ID in ${WRANGLER}.`);
  await fs.writeFile(WRANGLER, updated);
}

async function main() {
  await loadLocalEnv();
  const prompt = await systemPrompt();
  const voiceName = option('voice', 'Jessica');
  const llm = option('llm');

  if (dryRun) {
    const body = agentBody({ prompt, voiceId: `<stock voice “${voiceName}”>`, llm });
    body.conversation_config.agent.prompt.prompt = `<${prompt.length} characters>`;
    console.log(JSON.stringify(body, null, 2));
    console.log(`\n--- System prompt (${prompt.length} characters) ---\n\n${prompt}`);
    return;
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('Set ELEVENLABS_API_KEY in the environment or in .env.local.');
  }

  const voice = await stockVoice(voiceName);
  const body = agentBody({ prompt, voiceId: voice.voice_id, llm });
  const agentId = await readAgentId();
  if (agentId) {
    await elevenLabs(`/v1/convai/agents/${agentId}`, { method: 'PATCH', body: JSON.stringify(body) });
    console.log(`Updated agent ${agentId} (voice: ${voice.name}, prompt: ${prompt.length} characters).`);
  } else {
    const created = await elevenLabs('/v1/convai/agents/create', { method: 'POST', body: JSON.stringify(body) });
    await writeAgentId(created.agent_id);
    console.log(`Created agent ${created.agent_id} (voice: ${voice.name}, prompt: ${prompt.length} characters).`);
    console.log('Its ID is now in workers/portfolio-backend/wrangler.jsonc. Commit it and deploy the Worker.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
