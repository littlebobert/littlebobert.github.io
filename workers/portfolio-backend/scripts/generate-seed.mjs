import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteDirectory = path.resolve(workerDirectory, '../..');
const visitorCount = Number(process.argv[2]);

if (!Number.isInteger(visitorCount) || visitorCount < 0) {
  throw new Error('Usage: node scripts/generate-seed.mjs <current-visitor-count>');
}

async function readEntries(filename) {
  const contents = await readFile(path.join(siteDirectory, 'data', filename), 'utf8');
  const data = JSON.parse(contents);
  return Array.isArray(data.entries) ? data.entries : [];
}

function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

const [guestbook, tokyo, mud] = await Promise.all([
  readEntries('guestbook.json'),
  readEntries('tokyo-recommendations.json'),
  readEntries('mud-leaderboard.json'),
]);

const statements = [];

guestbook.forEach((entry) => {
  statements.push(`
INSERT OR IGNORE INTO guestbook_entries
  (id, name, country_code, country_name, comment, signed_at, submitted_at, status, approved_at, reviewed_at, source)
VALUES
  (${sql(entry.id)}, ${sql(entry.name)}, ${sql(entry.countryCode)}, ${sql(entry.countryName)},
   ${sql(entry.comment || '')}, ${sql(entry.signedAt)}, ${sql(entry.signedAt)}, 'approved',
   ${sql(entry.approvedAt)}, ${sql(entry.approvedAt)}, ${sql(entry.source || 'import')});`);
});

tokyo.forEach((entry) => {
  statements.push(`
INSERT OR IGNORE INTO tokyo_recommendations
  (id, name, recommendation, comment, submitted_at, status, approved_at, reviewed_at, source)
VALUES
  (${sql(entry.id)}, ${sql(entry.name)}, ${sql(entry.recommendation)}, ${sql(entry.comment || '')},
   ${sql(entry.submittedAt)}, 'approved', ${sql(entry.approvedAt)}, ${sql(entry.approvedAt)},
   ${sql(entry.source || 'import')});`);
});

mud.forEach((entry) => {
  const sideQuests = Array.isArray(entry.sideQuests) ? entry.sideQuests : [];
  statements.push(`
INSERT OR IGNORE INTO mud_scores
  (id, name, moves, side_quests, side_quest_count, rank, route, completed_at, submitted_at,
   status, approved_at, reviewed_at, source)
VALUES
  (${sql(entry.id)}, ${sql(entry.name)}, ${sql(entry.moves)}, ${sql(JSON.stringify(sideQuests))},
   ${sql(sideQuests.length)}, ${sql(entry.rank)}, ${sql(entry.route)}, ${sql(entry.completedAt)},
   ${sql(entry.completedAt)}, 'approved', ${sql(entry.approvedAt)}, ${sql(entry.approvedAt)},
   ${sql(entry.source || 'import')});`);
});

statements.push(`
INSERT INTO page_views (site, path, views, updated_at)
VALUES ('justin-garcia.pages.dev', '/', ${visitorCount}, ${sql(new Date().toISOString())})
ON CONFLICT(site, path) DO UPDATE SET
  views = MAX(page_views.views, excluded.views),
  updated_at = excluded.updated_at;`);
const outputPath = path.join(workerDirectory, 'seed.sql');
await writeFile(outputPath, `${statements.join('\n')}\n`);
console.log(`Wrote ${outputPath} with ${guestbook.length + tokyo.length + mud.length} approved entries and ${visitorCount} views.`);
