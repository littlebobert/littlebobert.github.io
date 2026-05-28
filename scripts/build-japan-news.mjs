import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { XMLParser } from 'fast-xml-parser';

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const OUTPUT_JSON = path.join(DATA_DIR, 'japan-news.json');
const OUTPUT_JS = path.join(DATA_DIR, 'japan-news.js');
const DEFAULT_SOURCE_URL = 'https://www3.nhk.or.jp/nhkworld/data/en/news/all.json';
const FALLBACK_SOURCE_URL = 'https://www.japantimes.co.jp/news/feed/';
const sourceUrl = process.env.JAPAN_NEWS_SOURCE_URL || process.env.JAPAN_NEWS_FEED_URL || DEFAULT_SOURCE_URL;
const requestedLimit = Number(process.env.JAPAN_NEWS_LIMIT || 5);
const itemLimit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 5, 1), 10);

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function textValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return textValue(value['#text'] || value._text || value['@_href'] || '');
  }
  return String(value);
}

function stripHtml(value) {
  return textValue(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDate(value) {
  const date = new Date(textValue(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function normalizeNhkTimestamp(value) {
  const timestamp = Number(value);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp).toISOString();
  }
  return normalizeDate(value);
}

function normalizeItem(item) {
  const link = textValue(item.link?.href || item.link);
  const description = stripHtml(item.description || item.summary || item['content:encoded']);

  return {
    title: stripHtml(item.title),
    url: link,
    publishedAt: normalizeDate(item.pubDate || item.published || item.updated),
    description,
  };
}

function normalizeNhkItem(item) {
  const pagePath = textValue(item.page_url);
  const url = pagePath.startsWith('http')
    ? pagePath
    : `https://www3.nhk.or.jp${pagePath}`;

  return {
    title: stripHtml(item.title),
    url,
    publishedAt: normalizeNhkTimestamp(item.updated_at || item.public_at || item.created_at),
    description: stripHtml(item.description),
  };
}

async function fetchText(url, accept) {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      'User-Agent': 'littlebobert-github-io/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Japan news request failed (${response.status}) for ${url}`);
  }

  return response.text();
}

async function fetchNhkNews(url) {
  const json = await fetchText(url, 'application/json');
  const payload = JSON.parse(json);
  const items = asArray(payload.data)
    .filter((item) => textValue(item.categories?.name).toUpperCase() === 'JAPAN')
    .map(normalizeNhkItem)
    .filter((item) => item.title && item.url)
    .slice(0, itemLimit);

  return {
    sourceName: 'NHK World Japan',
    sourceUrl: 'https://www3.nhk.or.jp/nhkworld/en/news/',
    feedUrl: url,
    items,
  };
}

async function fetchRssNews(url) {
  const xml = await fetchText(url, 'application/rss+xml, application/xml, text/xml');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const feed = parser.parse(xml);
  const channel = feed.rss?.channel || feed.feed || {};
  const rawItems = asArray(channel.item || channel.entry);
  const items = rawItems
    .map(normalizeItem)
    .filter((item) => item.title && item.url)
    .slice(0, itemLimit);

  return {
    sourceName: 'The Japan Times',
    sourceUrl: 'https://www.japantimes.co.jp/',
    feedUrl: url,
    items,
  };
}

async function fetchNews() {
  if (sourceUrl.endsWith('.json')) {
    const news = await fetchNhkNews(sourceUrl);
    if (news.items.length) {
      return news;
    }
    console.warn(`No NHK Japan items found in ${sourceUrl}; falling back to ${FALLBACK_SOURCE_URL}.`);
  }

  return fetchRssNews(sourceUrl.endsWith('.json') ? FALLBACK_SOURCE_URL : sourceUrl);
}

async function main() {
  const news = await fetchNews();
  const snapshot = {
    updatedAt: new Date().toISOString(),
    sourceName: news.sourceName,
    sourceUrl: news.sourceUrl,
    feedUrl: news.feedUrl,
    items: news.items,
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(snapshot, null, 2)}\n`);
  await fs.writeFile(OUTPUT_JS, `window.JAPAN_NEWS_SNAPSHOT = ${JSON.stringify(snapshot, null, 2)};\n`);
  console.log(`Wrote ${news.items.length} Japan news items from ${news.sourceName} to ${path.relative(ROOT_DIR, OUTPUT_JSON)}.`);
}

await main();
