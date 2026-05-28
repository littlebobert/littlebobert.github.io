import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ENV_FILE = path.join(process.cwd(), '.env.local');

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return key ? [key, value] : null;
}

async function loadLocalEnv() {
  try {
    const contents = await fs.readFile(ENV_FILE, 'utf8');
    contents.split(/\r?\n/).forEach((line) => {
      const entry = parseEnvLine(line);
      if (!entry) {
        return;
      }

      const [key, value] = entry;
      process.env[key] = process.env[key] || value;
    });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

await loadLocalEnv();
await import('./build-japan-news.mjs');
