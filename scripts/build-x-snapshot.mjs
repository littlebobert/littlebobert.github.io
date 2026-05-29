import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const GENERATED_DIR = path.join(ROOT_DIR, 'assets', 'generated', 'x');
const OUTPUT_JSON = path.join(DATA_DIR, 'x-posts.json');
const OUTPUT_JS = path.join(DATA_DIR, 'x-posts.js');
const X_API_BASE_URL = 'https://api.twitter.com/2';
const X_WEB_BASE_URL = 'https://x.com';
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const bearerToken = process.env.X_BEARER_TOKEN;
const username = (process.env.X_USERNAME || '_bobertdowney').replace(/^@/, '');
const requestedPostCount = Number(process.env.X_POST_LIMIT || 5);
const postCount = Math.min(Math.max(Number.isFinite(requestedPostCount) ? requestedPostCount : 5, 5), 10);

if (!bearerToken) {
  throw new Error('Missing X_BEARER_TOKEN environment variable.');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'User-Agent': 'littlebobert-github-io/1.0',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`X API request failed (${response.status}) for ${url}: ${body}`);
  }

  return response.json();
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'littlebobert-github-io/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Asset download failed (${response.status}) for ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function withLargeProfileImage(profileImageUrl) {
  return profileImageUrl?.replace('_normal.', '_400x400.');
}

function publicAssetPath(fileName) {
  return `assets/generated/x/${fileName}`;
}

function modernFileName(fileName) {
  return fileName.replace(/\.png$/i, '-modern.png');
}

async function saveModernPng(sourceBuffer, outputPath, options = {}) {
  const maxWidth = options.maxWidth || 640;
  const maxHeight = options.maxHeight || 420;
  await sharp(sourceBuffer)
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function ditherToPng(sourceBuffer, outputPath, options = {}) {
  const maxWidth = options.maxWidth || 640;
  const maxHeight = options.maxHeight || 420;
  const { data, info } = await sharp(sourceBuffer)
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const output = Buffer.alloc(info.width * info.height * 4);

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const sourceIndex = y * info.width + x;
      const outputIndex = sourceIndex * 4;
      const threshold = ((BAYER_4X4[y % 4][x % 4] + 0.5) / 16) * 255;
      const value = data[sourceIndex] > threshold ? 255 : 0;

      output[outputIndex] = value;
      output[outputIndex + 1] = value;
      output[outputIndex + 2] = value;
      output[outputIndex + 3] = 255;
    }
  }

  await sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png({ colors: 2, compressionLevel: 9 })
    .toFile(outputPath);
}

async function processRemoteImage(url, fileName, options) {
  const sourceBuffer = await fetchBuffer(url);
  const classicOutputPath = path.join(GENERATED_DIR, fileName);
  const modernName = modernFileName(fileName);
  const modernOutputPath = path.join(GENERATED_DIR, modernName);

  await Promise.all([
    ditherToPng(sourceBuffer, classicOutputPath, options),
    saveModernPng(sourceBuffer, modernOutputPath, options),
  ]);

  return {
    image: publicAssetPath(fileName),
    imageModern: publicAssetPath(modernName),
  };
}

function mediaImageUrl(media) {
  if (media.type === 'photo') {
    return media.url;
  }

  return media.preview_image_url;
}

function safeFilePart(value) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

function postTime(post) {
  const time = new Date(post.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortPostsNewestFirst(posts) {
  return [...posts].sort((a, b) => postTime(b) - postTime(a));
}

function tweetParams(count) {
  return new URLSearchParams({
    max_results: String(Math.min(Math.max(count, 5), 10)),
    exclude: 'retweets,replies',
    'tweet.fields': 'created_at,entities',
    expansions: 'attachments.media_keys',
    'media.fields': 'alt_text,preview_image_url,type,url,width,height',
  });
}

async function fetchUserByUsername(screenName) {
  const userParams = new URLSearchParams({
    'user.fields': 'name,profile_image_url,username',
  });
  const user = await fetchJson(`${X_API_BASE_URL}/users/by/username/${screenName}?${userParams}`);
  const xUser = user.data;

  if (!xUser?.id) {
    throw new Error(`Could not find X user ${screenName}.`);
  }

  return xUser;
}

async function fetchTweetsForUser(xUser, count) {
  return fetchJson(`${X_API_BASE_URL}/users/${xUser.id}/tweets?${tweetParams(count)}`);
}

async function processAvatar(xUser, fileName) {
  let avatar = '';
  let avatarModern = '';
  if (xUser.profile_image_url) {
    try {
      const processedAvatar = await processRemoteImage(withLargeProfileImage(xUser.profile_image_url), fileName, {
        maxWidth: 96,
        maxHeight: 96,
      });
      avatar = processedAvatar.image;
      avatarModern = processedAvatar.imageModern;
    } catch (error) {
      console.warn(`Could not process avatar for ${xUser.username}: ${error.message}`);
    }
  }
  return { avatar, avatarModern };
}

async function buildPostsForUser(xUser, options) {
  const tweets = await fetchTweetsForUser(xUser, options.count);
  const mediaByKey = new Map((tweets.includes?.media || []).map((media) => [media.media_key, media]));
  const { avatar, avatarModern } = await processAvatar(xUser, `${safeFilePart(options.mediaPrefix)}-avatar.png`);

  const posts = [];

  for (const tweet of tweets.data || []) {
    const media = [];
    const mediaKeys = tweet.attachments?.media_keys || [];

    for (let index = 0; index < mediaKeys.length; index += 1) {
      const mediaItem = mediaByKey.get(mediaKeys[index]);
      const sourceUrl = mediaItem ? mediaImageUrl(mediaItem) : '';

      if (!sourceUrl) {
        continue;
      }

      try {
        const fileName = `${safeFilePart(options.mediaPrefix)}-post-${tweet.id}-${index}.png`;
        const processedMedia = await processRemoteImage(sourceUrl, fileName, {
          maxWidth: 640,
          maxHeight: 420,
        });
        media.push({
          alt: mediaItem.alt_text || '',
          type: mediaItem.type,
          image: processedMedia.image,
          imageModern: processedMedia.imageModern,
        });
      } catch (error) {
        console.warn(`Could not process media for post ${tweet.id}: ${error.message}`);
      }
    }

    posts.push({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      url: `${X_WEB_BASE_URL}/${xUser.username}/status/${tweet.id}`,
      urls: (tweet.entities?.urls || []).map((url) => ({
        url: url.url,
        expandedUrl: url.expanded_url,
        displayUrl: url.display_url,
        start: url.start,
        end: url.end,
      })),
      avatar,
      avatarModern,
      authorName: xUser.name,
      username: xUser.username,
      media,
    });
  }

  return posts;
}

async function main() {
  const xUser = await fetchUserByUsername(username);

  await fs.rm(GENERATED_DIR, { recursive: true, force: true });
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });

  const posts = await buildPostsForUser(xUser, {
    count: postCount,
    mediaPrefix: 'mine',
  });

  const snapshot = {
    updatedAt: new Date().toISOString(),
    username: xUser.username,
    profileUrl: `${X_WEB_BASE_URL}/${xUser.username}`,
    posts,
  };

  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(snapshot, null, 2)}\n`);
  await fs.writeFile(OUTPUT_JS, `window.X_POSTS_SNAPSHOT = ${JSON.stringify(snapshot, null, 2)};\n`);
  console.log(`Wrote ${posts.length} X posts to ${path.relative(ROOT_DIR, OUTPUT_JSON)}.`);
}

await main();
