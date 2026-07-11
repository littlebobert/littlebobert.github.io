function timeInZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const n = (type) => {
    const p = parts.find((x) => x.type === type);
    return p ? String(Number(p.value)).padStart(2, '0') : '00';
  };
  return { h: n('hour'), m: n('minute'), s: n('second') };
}

function updateAnalogClock(prefix, time) {
  const hour = Number(time.h);
  const minute = Number(time.m);
  const second = Number(time.s);
  const hourDeg = ((hour % 12) + minute / 60 + second / 3600) * 30;
  const minuteDeg = (minute + second / 60) * 6;
  const secondDeg = second * 6;

  document.getElementById(`${prefix}-analog-hour`).style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
  document.getElementById(`${prefix}-analog-minute`).style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
  document.getElementById(`${prefix}-analog-second`).style.transform = `translateX(-50%) rotate(${secondDeg}deg)`;
}

function updateClocks() {
  const now = new Date();

  const tokyo = timeInZone(now, 'Asia/Tokyo');
  document.getElementById('tokyo-hours').textContent = tokyo.h;
  document.getElementById('tokyo-minutes').textContent = tokyo.m;
  document.getElementById('tokyo-seconds').textContent = tokyo.s;
  updateAnalogClock('tokyo', tokyo);

  const tampa = timeInZone(now, 'America/New_York');
  document.getElementById('tampa-hours').textContent = tampa.h;
  document.getElementById('tampa-minutes').textContent = tampa.m;
  document.getElementById('tampa-seconds').textContent = tampa.s;
  updateAnalogClock('tampa', tampa);
}

const STACK_CARD_STORAGE_KEY = 'about-stack-card-index';
const CLOCK_MODE_STORAGE_KEY = 'clock-display-mode';
const WEATHER_UNIT_STORAGE_KEY = 'weather-unit';
const VISITOR_COUNTED_STORAGE_KEY = 'page-views-counter-counted';
const PORTFOLIO_API_BASE_URL = 'https://portfolio-backend.justin-garcia.workers.dev';
const TURNSTILE_SITE_KEY = '0x4AAAAAADzny1gQWxbt_9AA';
const VISITOR_COUNTER_BASE_URL = PORTFOLIO_API_BASE_URL
  ? `${PORTFOLIO_API_BASE_URL}/api/v1`
  : 'https://page-views-api.ratneshc.com/api/v1';
const VISITOR_COUNTER_SITE = PORTFOLIO_API_BASE_URL ? 'justin-garcia.pages.dev' : 'littlebobert.github.io';
const VISITOR_COUNTER_PATH = '/';
const GUESTBOOK_FALLBACK_URL = 'data/guestbook.json';
const TOKYO_RECOMMENDATIONS_FALLBACK_URL = 'data/tokyo-recommendations.json';
const clockModeButtons = document.querySelectorAll('.clock-mode-segment');
const weatherUnitButtons = document.querySelectorAll('.weather-unit-segment');
const languageButtons = document.querySelectorAll('.language-segment');
const labelElements = document.querySelectorAll('[data-label-en][data-label-ja]');
const visitorCountElement = document.getElementById('visitor-count');
const qrCodeButton = document.getElementById('qr-code-button');
const tokyoRecommendationButton = document.getElementById('tokyo-recommendation-button');
const tokyoRecommendationsListElement = document.getElementById('tokyo-recommendations-list');
const xFeedElement = document.getElementById('x-feed');
const puzzleBoard = document.getElementById('puzzle-board');
const puzzleShuffleButton = document.getElementById('puzzle-shuffle');
const puzzleGiveUpButton = document.getElementById('puzzle-give-up');
const puzzleAlert = document.getElementById('puzzle-alert');
const puzzleAlertMessage = document.getElementById('puzzle-alert-message');
const puzzleAlertVideo = document.getElementById('puzzle-alert-video');
const puzzleAlertVideoFrame = document.getElementById('puzzle-alert-video-frame');
const puzzleAlertOkButton = document.getElementById('puzzle-alert-ok');
const contactSubmissionLinks = document.querySelectorAll('.contact-submission-link');
const submissionOverlay = document.getElementById('submission-overlay');
const submissionForm = document.getElementById('submission-form');
const submissionFields = document.getElementById('submission-fields');
const submissionTitle = document.getElementById('submission-title');
const submissionStatus = document.getElementById('submission-status');
const submissionSubmitButton = document.getElementById('submission-submit');
const submissionCloseButton = document.getElementById('submission-close');
const submissionCancelButton = document.getElementById('submission-cancel');
const submissionTurnstile = document.getElementById('submission-turnstile');
const PUZZLE_SIZE = 4;
const PUZZLE_TILE_COUNT = PUZZLE_SIZE * PUZZLE_SIZE;
const PUZZLE_EMPTY_TILE = PUZZLE_TILE_COUNT - 1;
const PUZZLE_SHUFFLE_MIN_MOVES = 4;
const PUZZLE_SHUFFLE_MAX_MOVES = 5;
const weatherLocations = [
  {
    id: 'tokyo',
    name: 'Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
  },
  {
    id: 'tampa',
    name: 'Tampa',
    latitude: 27.9506,
    longitude: -82.4572,
  },
];
let currentWeatherUnit = 'imperial';
let weatherReadings = {};
let currentLanguage = 'en';
let xSnapshotData = window.X_POSTS_SNAPSHOT || null;
let xSnapshotDidFail = false;
let tokyoRecommendations = [];
let puzzleTiles = Array.from({ length: PUZZLE_TILE_COUNT }, (_, index) => index);
let puzzleGiveUpLocked = false;
let activeSubmission = null;
let submissionTurnstileToken = '';
let submissionTurnstileWidgetId = null;

function normalizeClockMode(mode) {
  return mode === 'analog' ? 'analog' : 'digital';
}

function normalizeWeatherUnit(unit) {
  return unit === 'metric' ? 'metric' : 'imperial';
}

function getSavedClockMode() {
  try {
    return normalizeClockMode(localStorage.getItem(CLOCK_MODE_STORAGE_KEY));
  } catch {
    return 'digital';
  }
}

function setClockMode(mode) {
  const value = normalizeClockMode(mode);
  document.documentElement.dataset.clockMode = value;
  try {
    localStorage.setItem(CLOCK_MODE_STORAGE_KEY, value);
  } catch {}
  clockModeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.clockModeValue === value ? 'true' : 'false');
  });
}

function getSavedWeatherUnit() {
  try {
    return normalizeWeatherUnit(localStorage.getItem(WEATHER_UNIT_STORAGE_KEY));
  } catch {
    return 'imperial';
  }
}

function setWeatherUnit(unit) {
  currentWeatherUnit = normalizeWeatherUnit(unit);
  try {
    localStorage.setItem(WEATHER_UNIT_STORAGE_KEY, currentWeatherUnit);
  } catch {}
  weatherUnitButtons.forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.weatherUnitValue === currentWeatherUnit ? 'true' : 'false');
  });
  renderWeather();
}

function formatTemperature(celsius) {
  if (typeof celsius !== 'number') {
    return '-';
  }
  if (currentWeatherUnit === 'metric') {
    return `${Math.round(celsius)}C`;
  }
  return `${Math.round((celsius * 9) / 5 + 32)}F`;
}

function weatherCodeLabel(code) {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Clouds';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Storm';
  return 'Weather';
}

function renderWeather() {
  weatherLocations.forEach((location) => {
    const element = document.getElementById(`${location.id}-weather`);
    const reading = weatherReadings[location.id];
    if (!element) {
      return;
    }
    if (!reading) {
      element.textContent = '-';
      return;
    }
    element.textContent = `${formatTemperature(reading.temperatureC)} ${weatherCodeLabel(reading.weatherCode)}`;
  });
}

async function fetchWeather() {
  try {
    const responses = await Promise.all(weatherLocations.map(async (location) => {
      const params = new URLSearchParams({
        latitude: location.latitude,
        longitude: location.longitude,
        current: 'temperature_2m,weather_code',
        temperature_unit: 'celsius',
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) {
        throw new Error(`Weather request failed: ${response.status}`);
      }
      const data = await response.json();
      return {
        id: location.id,
        temperatureC: data.current?.temperature_2m,
        weatherCode: data.current?.weather_code,
      };
    }));

    weatherReadings = responses.reduce((readings, reading) => {
      readings[reading.id] = reading;
      return readings;
    }, {});
    renderWeather();
  } catch (error) {
    weatherReadings = {};
    weatherLocations.forEach((location) => {
      const element = document.getElementById(`${location.id}-weather`);
      if (element) {
        element.textContent = '-';
      }
    });
  }
}

function hasCountedVisitorThisSession() {
  try {
    return sessionStorage.getItem(VISITOR_COUNTED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markVisitorCountedThisSession() {
  try {
    sessionStorage.setItem(VISITOR_COUNTED_STORAGE_KEY, 'true');
  } catch {}
}

function formatVisitorCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) {
    return '-';
  }
  return String(Math.max(0, Math.floor(count)));
}

function visitorCounterUrl(endpoint) {
  const params = new URLSearchParams({
    site: VISITOR_COUNTER_SITE,
    path: VISITOR_COUNTER_PATH,
  });
  return `${VISITOR_COUNTER_BASE_URL}/${endpoint}?${params}`;
}

async function fetchVisitorCount() {
  if (!visitorCountElement) {
    return;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4000);

  try {
    if (!hasCountedVisitorThisSession()) {
      const trackResponse = await fetch(visitorCounterUrl('track'), {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!trackResponse.ok) {
        throw new Error(`Visitor counter tracking failed: ${trackResponse.status}`);
      }
      markVisitorCountedThisSession();
    }

    const response = await fetch(visitorCounterUrl('views'), {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Visitor counter request failed: ${response.status}`);
    }
    const data = await response.json();
    visitorCountElement.textContent = formatVisitorCount(data.views);
  } catch (error) {
    visitorCountElement.textContent = '-';
  } finally {
    window.clearTimeout(timeout);
  }
}

function localizedText(en, ja) {
  return currentLanguage === 'ja' ? ja : en;
}

function isPuzzleSolved() {
  return puzzleTiles.every((tile, index) => tile === index);
}

function puzzleCoordinates(index) {
  return {
    row: Math.floor(index / PUZZLE_SIZE),
    column: index % PUZZLE_SIZE,
  };
}

function getPuzzleNeighborIndexes(index) {
  const { row, column } = puzzleCoordinates(index);
  return [
    row > 0 ? index - PUZZLE_SIZE : null,
    row < PUZZLE_SIZE - 1 ? index + PUZZLE_SIZE : null,
    column > 0 ? index - 1 : null,
    column < PUZZLE_SIZE - 1 ? index + 1 : null,
  ].filter((value) => value !== null);
}

function getPuzzleEmptyIndex() {
  return puzzleTiles.indexOf(PUZZLE_EMPTY_TILE);
}

function isPuzzleTileMovable(index) {
  const emptyIndex = getPuzzleEmptyIndex();
  if (emptyIndex === -1) {
    return false;
  }
  const tilePosition = puzzleCoordinates(index);
  const emptyPosition = puzzleCoordinates(emptyIndex);
  return Math.abs(tilePosition.row - emptyPosition.row) + Math.abs(tilePosition.column - emptyPosition.column) === 1;
}

function swapPuzzleTiles(firstIndex, secondIndex) {
  const firstTile = puzzleTiles[firstIndex];
  puzzleTiles[firstIndex] = puzzleTiles[secondIndex];
  puzzleTiles[secondIndex] = firstTile;
}

function renderPuzzle() {
  if (!puzzleBoard) {
    return;
  }

  puzzleBoard.textContent = '';
  puzzleTiles.forEach((tile, index) => {
    const isEmpty = tile === PUZZLE_EMPTY_TILE;
    const cell = document.createElement(isEmpty ? 'span' : 'button');
    cell.className = 'puzzle-tile';

    if (isEmpty) {
      cell.classList.add('is-empty');
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', localizedText('Empty space', '空きスペース'));
    } else {
      const { row, column } = puzzleCoordinates(tile);
      const movable = isPuzzleTileMovable(index);
      cell.type = 'button';
      cell.classList.toggle('is-movable', movable);
      cell.style.backgroundPosition = `${(column / (PUZZLE_SIZE - 1)) * 100}% ${(row / (PUZZLE_SIZE - 1)) * 100}%`;
      cell.setAttribute('aria-label', localizedText(`Tile ${tile + 1}`, `タイル${tile + 1}`));
      cell.addEventListener('click', () => {
        movePuzzleTile(index);
        cell.blur();
      });
    }

    puzzleBoard.append(cell);
  });

  if (puzzleGiveUpButton) {
    puzzleGiveUpButton.disabled = puzzleGiveUpLocked;
  }
}

function movePuzzleTile(index) {
  if (!isPuzzleTileMovable(index)) {
    return;
  }
  swapPuzzleTiles(index, getPuzzleEmptyIndex());
  if (isPuzzleSolved()) {
    puzzleGiveUpLocked = true;
    showPuzzleAlert(localizedText("Here's to the crazy ones", 'クレイジーな人たちへ'), { showVideo: true });
  }
  renderPuzzle();
}

function resetPuzzle() {
  puzzleTiles = Array.from({ length: PUZZLE_TILE_COUNT }, (_, index) => index);
  renderPuzzle();
}

function shufflePuzzle() {
  puzzleGiveUpLocked = false;
  resetPuzzle();
  let emptyIndex = getPuzzleEmptyIndex();
  let previousEmptyIndex = -1;
  const moveCount = PUZZLE_SHUFFLE_MIN_MOVES
    + Math.floor(Math.random() * (PUZZLE_SHUFFLE_MAX_MOVES - PUZZLE_SHUFFLE_MIN_MOVES + 1));

  for (let moveIndex = 0; moveIndex < moveCount; moveIndex += 1) {
    const neighbors = getPuzzleNeighborIndexes(emptyIndex);
    const candidates = neighbors.filter((index) => index !== previousEmptyIndex);
    const nextIndex = candidates.length
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : neighbors[0];
    swapPuzzleTiles(emptyIndex, nextIndex);
    previousEmptyIndex = emptyIndex;
    emptyIndex = nextIndex;
  }

  if (isPuzzleSolved()) {
    swapPuzzleTiles(emptyIndex, getPuzzleNeighborIndexes(emptyIndex)[0]);
  }

  renderPuzzle();
}

function showPuzzleAlert(message, options = {}) {
  if (!puzzleAlert) {
    return;
  }
  if (puzzleAlertMessage) {
    puzzleAlertMessage.textContent = message;
  }
  const shouldShowVideo = options.showVideo === true;
  puzzleAlert.classList.toggle('has-video', shouldShowVideo);
  if (puzzleAlertVideo) {
    puzzleAlertVideo.hidden = !shouldShowVideo;
  }
  if (puzzleAlertVideoFrame) {
    if (shouldShowVideo) {
      puzzleAlertVideoFrame.src = puzzleAlertVideoFrame.dataset.src;
    } else {
      puzzleAlertVideoFrame.removeAttribute('src');
    }
  }
  puzzleAlert.hidden = false;
  puzzleAlertOkButton?.focus();
}

function hidePuzzleAlert() {
  if (!puzzleAlert) {
    return;
  }
  puzzleAlert.hidden = true;
  puzzleAlert.classList.remove('has-video');
  if (puzzleAlertVideo) {
    puzzleAlertVideo.hidden = true;
  }
  puzzleAlertVideoFrame?.removeAttribute('src');
  puzzleGiveUpButton?.focus();
}

function formatXPostDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(currentLanguage === 'ja' ? 'ja-JP' : 'en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function xPostTime(post) {
  const time = new Date(post.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortXPostsNewestFirst(posts) {
  return [...posts].sort((a, b) => xPostTime(b) - xPostTime(a));
}

function updateFeedScrollFade(feedElement) {
  if (!feedElement) {
    return;
  }

  const feedPanel = feedElement.closest('.feed-panel');
  const stackCard = feedElement.closest('[data-stack-card]');

  requestAnimationFrame(() => {
    if (stackCard?.hidden) {
      feedPanel?.classList.remove('has-scroll-overflow');
      return;
    }

    const hasOverflow = feedElement.scrollHeight > feedElement.clientHeight + 1;
    const atBottom = feedElement.scrollTop + feedElement.clientHeight >= feedElement.scrollHeight - 1;
    const showFade = hasOverflow && !atBottom;

    feedPanel?.classList.toggle('has-scroll-overflow', showFade);
  });
}

function refreshFeedScrollFades() {
  updateFeedScrollFade(xFeedElement);
}

function bindFeedScrollFade(feedElement) {
  if (!feedElement) {
    return;
  }

  const update = () => updateFeedScrollFade(feedElement);
  feedElement.addEventListener('scroll', update, { passive: true });
  return update;
}

const RETRO_EMOJI_LABELS = new Map([
  ['\u{1F600}', ':)'],
  ['\u{1F603}', ':D'],
  ['\u{1F604}', ':D'],
  ['\u{1F601}', ':D'],
  ['\u{1F642}', ':)'],
  ['\u{1F60A}', ':)'],
  ['\u{1F609}', ';)'],
  ['\u{1F602}', 'XD'],
  ['\u{1F923}', 'ROFL'],
  ['\u{1F62D}', ';_;'],
  ['\u{1F605}', '^^;'],
  ['\u{1F62C}', ':S'],
  ['\u{1F60E}', 'B)'],
  ['\u{1F60D}', '<3'],
  ['\u{1F970}', '<3'],
  ['\u2764', '<3'],
  ['\u{1F49C}', '<3'],
  ['\u{1F525}', '[fire]'],
  ['\u2728', '*'],
  ['\u{1F44D}', '[ok]'],
  ['\u{1F44F}', '[clap]'],
  ['\u{1F64F}', '[please]'],
  ['\u{1F480}', '[dead]'],
  ['\u{1F92F}', '[mind-blown]'],
  ['\u{1F974}', '[woozy-face]'],
  ['\u{1F635}', '[dizzy-face]'],
  ['\u{1F635}\u200D\u{1F4AB}', '[dizzy-face]'],
  ['\u{1F914}', '[thinking]'],
  ['\u{1F643}', '(:'],
  ['\u{1F622}', ':('],
  ['\u{1F621}', '>:('],
  ['\u{1F624}', '[huff]'],
  ['\u{1F680}', '[rocket]'],
  ['\u2705', '[ok]'],
  ['\u274C', '[no]'],
  ['\u2B50', '*'],
  ['\u2615', '[coffee]'],
  ['\u{1F37A}', '[beer]'],
  ['\u{1F37B}', '[cheers]'],
  ['\u{1F35C}', '[ramen]'],
  ['\u{1F363}', '[sushi]'],
  ['\u{1F440}', '[eyes]'],
  ['\u{1F4A9}', '[poop]'],
  ['\u{1FAE1}', '[salute]'],
]);
const EMOJI_PATTERN = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F300}-\u{1FAFF}][\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]*(?:\u200D[\u{1F300}-\u{1FAFF}][\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]*)*|[\u2600-\u27BF]\uFE0F?)/gu;
const URL_PATTERN = /https?:\/\/[^\s]+/g;

function normalizeEmojiToken(token) {
  return token
    .replace(/[\uFE0E\uFE0F]/g, '')
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
}

function retroEmojiLabel(token) {
  const normalized = normalizeEmojiToken(token);
  if (/^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(normalized)) {
    return '[flag]';
  }
  return RETRO_EMOJI_LABELS.get(normalized) || '[emoji]';
}

function appendRetroText(parent, value) {
  const text = value || '';
  let lastIndex = 0;

  text.replace(EMOJI_PATTERN, (match, offset) => {
    if (offset > lastIndex) {
      parent.append(document.createTextNode(text.slice(lastIndex, offset)));
    }
    parent.append(document.createTextNode(retroEmojiLabel(match)));
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    parent.append(document.createTextNode(text.slice(lastIndex)));
  }
}

function codePointOffsetToStringOffset(text, offset) {
  if (!Number.isInteger(offset) || offset < 0) {
    return -1;
  }
  return Array.from(text).slice(0, offset).join('').length;
}

function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

function addLinkRange(ranges, range) {
  if (
    !range
    || range.start < 0
    || range.end <= range.start
    || ranges.some((existing) => rangesOverlap(existing, range))
  ) {
    return;
  }
  ranges.push(range);
}

function buildXPostLinkRanges(text, post) {
  const ranges = [];
  const urls = Array.isArray(post.urls) ? post.urls : [];

  urls.forEach((url) => {
    const href = url.expandedUrl || url.expanded_url || url.url;
    const label = url.displayUrl || url.display_url || href;
    let start = url.url ? text.indexOf(url.url) : -1;
    let end = start >= 0 ? start + url.url.length : -1;

    if (start === -1 && Number.isInteger(url.start) && Number.isInteger(url.end)) {
      start = codePointOffsetToStringOffset(text, url.start);
      end = codePointOffsetToStringOffset(text, url.end);
    }

    addLinkRange(ranges, { start, end, href, label });
  });

  text.replace(URL_PATTERN, (match, offset) => {
    addLinkRange(ranges, {
      start: offset,
      end: offset + match.length,
      href: match,
      label: match.replace(/^https?:\/\//, ''),
    });
    return match;
  });

  return ranges.sort((a, b) => a.start - b.start);
}

function appendLinkedRetroText(parent, text, post) {
  const ranges = buildXPostLinkRanges(text, post);
  let cursor = 0;

  ranges.forEach((range) => {
    appendRetroText(parent, text.slice(cursor, range.start));

    const link = document.createElement('a');
    link.href = range.href;
    link.textContent = range.label;
    parent.append(link);

    cursor = range.end;
  });

  appendRetroText(parent, text.slice(cursor));
}

function appendXFeedStatus(message) {
  if (!xFeedElement) {
    return;
  }

  xFeedElement.textContent = '';
  const status = document.createElement('p');
  status.className = 'x-feed-status';
  status.textContent = message;
  xFeedElement.append(status);
  updateFeedScrollFade(xFeedElement);
}

function getCurrentXPosts() {
  if (!xSnapshotData) {
    return [];
  }
  return sortXPostsNewestFirst(Array.isArray(xSnapshotData.posts) ? xSnapshotData.posts : []);
}

function emptyXFeedMessage() {
  return localizedText(
    'No posts captured yet. Run the snapshot action.',
    'まだ投稿がありません。スナップショットのActionを実行してください。'
  );
}

function appendThemeImage(parent, options) {
  if (!options.src) {
    return;
  }

  const image = document.createElement('img');
  image.className = options.className;
  if (options.modernSrc) {
    image.classList.add('has-modern-alternate');
  }
  image.src = options.src;
  image.alt = options.alt || '';
  image.loading = 'lazy';
  parent.append(image);

  if (!options.modernSrc) {
    return;
  }

  const modernImage = document.createElement('img');
  modernImage.className = `${options.className} ${options.className}-modern`;
  modernImage.src = options.modernSrc;
  modernImage.alt = options.alt || '';
  modernImage.loading = 'lazy';
  parent.append(modernImage);
}

function createXPostElement(post) {
  const article = document.createElement('article');
  article.className = 'x-post';

  const header = document.createElement('div');
  header.className = 'x-post-header';

  if (post.avatar) {
    appendThemeImage(header, {
      className: 'x-post-avatar',
      src: post.avatar,
      modernSrc: post.avatarModern,
    });
  } else {
    article.classList.add('x-post-no-avatar');
  }

  const identity = document.createElement('div');
  identity.className = 'x-post-identity';

  const name = document.createElement('strong');
  name.textContent = post.authorName || post.username || 'Justin';
  identity.append(name);

  const meta = document.createElement('span');
  const username = post.username ? `@${post.username}` : '@_bobertdowney';
  const date = formatXPostDate(post.createdAt);
  meta.textContent = date ? `${username} / ${date}` : username;
  identity.append(meta);
  header.append(identity);
  article.append(header);

  const text = document.createElement('p');
  text.className = 'x-post-text';
  appendLinkedRetroText(text, post.text || '', post);
  article.append(text);

  const firstImage = Array.isArray(post.media) ? post.media.find((item) => item.image) : null;
  if (firstImage) {
    appendThemeImage(article, {
      className: 'x-post-media',
      src: firstImage.image,
      modernSrc: firstImage.imageModern,
      alt: firstImage.alt,
    });
  }

  if (post.url) {
    const link = document.createElement('a');
    link.className = 'x-post-link';
    link.href = post.url;
    link.textContent = localizedText('Open post', '投稿を見る');
    article.append(link);
  }

  return article;
}

function renderXSnapshot() {
  if (!xFeedElement) {
    return;
  }

  if (xSnapshotDidFail) {
    appendXFeedStatus(localizedText('X gremlin is sleeping.', 'Xの妖精は寝ています。'));
    return;
  }

  if (!xSnapshotData) {
    appendXFeedStatus(localizedText('Loading daily snapshot...', '毎日のスナップショットを読み込み中...'));
    return;
  }

  const posts = getCurrentXPosts();
  if (!posts.length) {
    appendXFeedStatus(emptyXFeedMessage());
    return;
  }

  xFeedElement.textContent = '';
  const updatedAt = formatXPostDate(xSnapshotData.updatedAt);
  const postCount = posts.length;
  if (updatedAt) {
    const note = document.createElement('p');
    note.className = 'x-feed-updated';
    note.textContent = localizedText(
      `Snapshot from ${updatedAt}. ${postCount} ${postCount === 1 ? 'post' : 'posts'}`,
      `${updatedAt}のスナップショット。${postCount}件`
    );
    xFeedElement.append(note);
  }

  posts.forEach((post) => {
    xFeedElement.append(createXPostElement(post));
  });
  updateFeedScrollFade(xFeedElement);
}

async function fetchXSnapshot() {
  if (!xFeedElement) {
    return;
  }

  if (window.X_POSTS_SNAPSHOT) {
    xSnapshotData = window.X_POSTS_SNAPSHOT;
    xSnapshotDidFail = false;
    renderXSnapshot();
  }

  try {
    const response = await fetch('data/x-posts.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`X snapshot request failed: ${response.status}`);
    }
    xSnapshotData = await response.json();
    xSnapshotDidFail = false;
  } catch (error) {
    if (!xSnapshotData) {
      xSnapshotDidFail = true;
    }
  }

  renderXSnapshot();
}

clockModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setClockMode(button.dataset.clockModeValue);
    button.blur();
  });
});

weatherUnitButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setWeatherUnit(button.dataset.weatherUnitValue);
    button.blur();
  });
});

puzzleShuffleButton?.addEventListener('click', () => {
  shufflePuzzle();
  puzzleShuffleButton.blur();
});

puzzleGiveUpButton?.addEventListener('click', () => {
  showPuzzleAlert(localizedText('Never give up. Never surrender.', 'あきらめないで。'));
  puzzleGiveUpButton.blur();
});

puzzleAlertOkButton?.addEventListener('click', () => {
  hidePuzzleAlert();
  puzzleAlertOkButton.blur();
});

function setLanguage(language) {
  currentLanguage = language === 'ja' ? 'ja' : 'en';
  labelElements.forEach((element) => {
    element.innerHTML = element.dataset[`label${currentLanguage === 'ja' ? 'Ja' : 'En'}`];
  });

  document.documentElement.lang = currentLanguage;
  languageButtons.forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.languageValue === currentLanguage ? 'true' : 'false');
  });
  document.title = currentLanguage === 'ja' ? 'Justin Garcia について' : 'About Justin Garcia';
  localStorage.setItem('site-language', currentLanguage);
  if (selectedMapCountryCode) {
    selectedMapPlace = getRegionName(selectedMapCountryCode);
    updateMapStatus(selectedMapPlace);
  }
  renderXSnapshot();
  renderPuzzle();
  renderGuestbook();
  renderTokyoRecommendations();
  document.dispatchEvent(new CustomEvent('site-language-change', {
    detail: { language: currentLanguage },
  }));
}

languageButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setLanguage(button.dataset.languageValue);
    button.blur();
  });
});

tokyoRecommendationButton?.addEventListener('click', () => {
  openPortfolioSubmission('tokyo-recommendation');
  tokyoRecommendationButton.blur();
});

const aboutSlot = document.getElementById('about-slot');
const aboutDialog = document.getElementById('about-dialog');
const aboutDesktopIcon = document.getElementById('about-desktop-icon');
const aboutCloseButton = aboutDialog?.querySelector('.close-box--close');
const webBrowserSlot = document.getElementById('web-browser-slot');
const webBrowserDialog = document.getElementById('web-browser-dialog');
const webBrowserCloseButton = document.getElementById('web-browser-close');
const webBrowserFrame = document.getElementById('web-browser-frame');
const webBrowserAddress = document.getElementById('web-browser-address');
const webBrowserOpenExternalButton = document.getElementById('web-browser-open-external');
const webBrowserTitle = document.getElementById('web-browser-title');
const galleryPhotoButtons = document.querySelectorAll('.gallery-photo-frame[data-gallery-image]');
const galleryViewerSlot = document.getElementById('gallery-viewer-slot');
const galleryViewerDialog = document.getElementById('gallery-viewer-dialog');
const galleryViewerCloseButton = document.getElementById('gallery-viewer-close');
const galleryViewerImage = document.getElementById('gallery-viewer-image');
const galleryViewerCaption = document.getElementById('gallery-viewer-caption');
const galleryViewerTitle = document.getElementById('gallery-viewer-title');
const qrCodeSlot = document.getElementById('qr-code-slot');
const qrCodeDialog = document.getElementById('qr-code-dialog');
const qrCodeCloseButton = document.getElementById('qr-code-close');
const windowZoomRect = document.getElementById('window-zoom-rect');
const hypercardStack = document.getElementById('hypercard-stack');
const stackCards = Array.from(document.querySelectorAll('[data-stack-card]'));
const stackCounter = document.getElementById('stack-counter');
const stackPrevButton = document.getElementById('stack-prev');
const stackNextButton = document.getElementById('stack-next');
const worldMapFrame = document.getElementById('world-map-frame');
const worldMapLayer = document.getElementById('world-map-layer');
const worldMapObject = document.getElementById('world-map-svg');
const selectedMapPin = document.getElementById('selected-map-pin');
const mapLocationStatus = document.getElementById('map-location-status');
const guestbookListElement = document.getElementById('guestbook-list');
const mapEmailButton = document.getElementById('map-email-button');
const mapZoomInButton = document.getElementById('map-zoom-in');
const mapZoomOutButton = document.getElementById('map-zoom-out');
let expandedAboutHeight = 0;
let isWindowAnimating = false;
let currentStackCardIndex = 0;
let stackTouchStartX = null;
let stackTouchStartY = null;
let selectedMapCountryCode = '';
let selectedMapPlace = '';
let selectedMapCountryElement = null;
let guestbookEntries = [];
let mapZoom = 1;
let mapPanX = 0;
let mapPanY = 0;
let mapPointerStart = null;
let suppressMapClick = false;
let lastMapTap = null;
let lastPageTap = null;
let lastTouchWindowShadeAt = 0;
let stackTransitionTimeout = null;
let currentWebBrowserUrl = '';
let currentWebBrowserTitle = null;
let currentGalleryPhoto = null;

const ZOOM_OPEN_MS = 220;
const ZOOM_CLOSE_MS = 200;
const ZOOM_SHADE_MS = 110;
const BOOT_ICON_PAUSE_MS = 500;
const MAP_DOUBLE_TAP_MS = 320;
const MAP_DOUBLE_TAP_DISTANCE = 28;
const STACK_WIPE_MS = 220;

function clearStackTransition() {
  if (stackTransitionTimeout) {
    clearTimeout(stackTransitionTimeout);
    stackTransitionTimeout = null;
  }
  hypercardStack?.classList.remove('is-card-wiping');
  hypercardStack?.removeAttribute('data-card-transition');
}

function updateStackCard(direction = 0) {
  const shouldAnimate = direction !== 0 && hypercardStack && !prefersReducedMotion();
  if (shouldAnimate) {
    clearStackTransition();
    hypercardStack.dataset.cardTransition = direction > 0 ? 'next' : 'prev';
  }

  stackCards.forEach((card, index) => {
    const isActive = index === currentStackCardIndex;
    card.hidden = !isActive;
    card.classList.toggle('is-active', isActive);
  });

  if (shouldAnimate) {
    void hypercardStack.offsetWidth;
    hypercardStack.classList.add('is-card-wiping');
    stackTransitionTimeout = setTimeout(clearStackTransition, STACK_WIPE_MS + 40);
  }

  if (stackCounter) {
    stackCounter.textContent = `${currentStackCardIndex + 1} / ${stackCards.length}`;
  }

  try {
    localStorage.setItem(STACK_CARD_STORAGE_KEY, String(currentStackCardIndex));
  } catch {}

  requestAnimationFrame(() => {
    if (!aboutDialog.classList.contains('is-closed') && !aboutDialog.classList.contains('window-shaded')) {
      storeExpandedAboutHeight();
    }
    refreshFeedScrollFades();
  });
}

function showRelativeStackCard(direction) {
  if (!stackCards.length) {
    return;
  }

  currentStackCardIndex = (currentStackCardIndex + direction + stackCards.length) % stackCards.length;
  updateStackCard(direction);
}

function showStackCard(index) {
  if (!Number.isInteger(index) || index < 0 || index >= stackCards.length || index === currentStackCardIndex) {
    return;
  }

  const direction = index > currentStackCardIndex ? 1 : -1;
  currentStackCardIndex = index;
  updateStackCard(direction);
}

function getSavedStackCardIndex() {
  try {
    const savedIndex = Number(localStorage.getItem(STACK_CARD_STORAGE_KEY));
    if (Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < stackCards.length) {
      return savedIndex;
    }
  } catch {}
  return stackCards.length > 1 ? 1 : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

currentStackCardIndex = getSavedStackCardIndex();

function isSameSitePageUrl(url) {
  if (!['http:', 'https:', 'file:'].includes(url.protocol)) {
    return false;
  }

  if (url.protocol === 'file:' || window.location.protocol === 'file:') {
    return url.protocol === window.location.protocol && url.pathname !== window.location.pathname;
  }

  return url.origin === window.location.origin;
}

function shouldOpenInDesktopBrowser(link, event) {
  if (event.defaultPrevented || event.button !== 0) {
    return false;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  if (link.target && link.target !== '_self') {
    return false;
  }

  if (link.hasAttribute('download')) {
    return false;
  }

  const href = link.getAttribute('href');
  if (!href || href.startsWith('#')) {
    return false;
  }

  let url;
  try {
    url = new URL(link.href, window.location.href);
  } catch {
    return false;
  }

  return isSameSitePageUrl(url);
}

function formatBrowserAddress(url) {
  try {
    const parsedUrl = new URL(url, window.location.href);
    if (parsedUrl.protocol === 'file:') {
      return parsedUrl.pathname.split('/').pop() || parsedUrl.pathname;
    }

    return `${parsedUrl.pathname.replace(/^\//, '') || '/'}${parsedUrl.hash}`;
  } catch {
    return url;
  }
}

function textFromHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.textContent.trim();
}

function stripActionText(text) {
  return text
    .replace(/^Open\s+/i, '')
    .replace(/\s+を見る$/, '')
    .trim();
}

function fallbackTitleFromUrl(url) {
  try {
    const parsedUrl = new URL(url, window.location.href);
    const filename = parsedUrl.pathname.split('/').pop();
    const titles = {
      'resume.html': { en: 'Resume', ja: '履歴書' },
      'sasu.html': { en: 'Sasu', ja: 'Sasu' },
      'kyoto.html': { en: 'Kyoto', ja: '京都' },
    };
    if (titles[filename]) {
      return titles[filename];
    }

    const fallback = filename
      ? filename.replace(/\.html$/i, '').replace(/[-_]+/g, ' ')
      : 'Desktop Browser';
    return { en: fallback, ja: fallback };
  } catch {
    return { en: 'Desktop Browser', ja: 'デスクトップブラウザ' };
  }
}

function titleFromLink(url, link) {
  const fallback = fallbackTitleFromUrl(url);
  if (!link) {
    return fallback;
  }

  const titleEn = link.dataset.browserTitleEn
    || (link.dataset.labelEn ? stripActionText(textFromHtml(link.dataset.labelEn)) : '');
  const titleJa = link.dataset.browserTitleJa
    || (link.dataset.labelJa ? stripActionText(textFromHtml(link.dataset.labelJa)) : '');
  return {
    en: titleEn || fallback.en,
    ja: titleJa || titleEn || fallback.ja,
  };
}

function localizedWindowTitle(title) {
  if (!title) {
    return '';
  }

  return currentLanguage === 'ja' ? title.ja || title.en : title.en || title.ja;
}

function updateDesktopBrowserTitle() {
  if (webBrowserTitle && currentWebBrowserTitle) {
    webBrowserTitle.textContent = localizedWindowTitle(currentWebBrowserTitle);
  }
}

function openDesktopBrowser(url, title = fallbackTitleFromUrl(url)) {
  if (!webBrowserSlot || !webBrowserDialog || !webBrowserFrame) {
    window.location.href = url;
    return;
  }

  currentWebBrowserUrl = url;
  currentWebBrowserTitle = title;
  webBrowserFrame.src = url;
  if (webBrowserAddress) {
    webBrowserAddress.textContent = formatBrowserAddress(url);
  }
  updateDesktopBrowserTitle();

  webBrowserSlot.classList.remove('is-closed');
  webBrowserDialog.classList.remove('is-closed', 'window-shaded');
  webBrowserDialog.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function closeDesktopBrowser() {
  if (!webBrowserSlot || !webBrowserDialog || !webBrowserFrame) {
    return;
  }

  webBrowserSlot.classList.add('is-closed');
  webBrowserDialog.classList.remove('window-shaded');
  webBrowserDialog.classList.add('is-closed');
  webBrowserFrame.src = 'about:blank';
  currentWebBrowserUrl = '';
  currentWebBrowserTitle = null;
  if (webBrowserAddress) {
    webBrowserAddress.textContent = 'about:blank';
  }
  if (webBrowserTitle) {
    webBrowserTitle.textContent = localizedText('Desktop Browser', 'デスクトップブラウザ');
  }
}

function getGalleryPhotoSource(photo) {
  if (!photo) {
    return '';
  }

  return document.documentElement.dataset.theme === 'bw'
    ? photo.ditheredImage
    : photo.image;
}

function updateGalleryViewerPhoto() {
  if (!currentGalleryPhoto || !galleryViewerImage || !galleryViewerCaption) {
    return;
  }

  const isDithered = document.documentElement.dataset.theme === 'bw';
  const title = localizedWindowTitle({
    en: currentGalleryPhoto.captionEn,
    ja: currentGalleryPhoto.captionJa,
  });
  galleryViewerImage.src = getGalleryPhotoSource(currentGalleryPhoto);
  galleryViewerImage.alt = currentGalleryPhoto.captionEn;
  galleryViewerImage.classList.toggle('is-dithered', isDithered);
  galleryViewerCaption.textContent = title;
  if (galleryViewerTitle) {
    galleryViewerTitle.textContent = title;
  }
}

function openGalleryViewer(button) {
  if (!galleryViewerSlot || !galleryViewerDialog || !galleryViewerImage || !galleryViewerCaption) {
    return;
  }

  currentGalleryPhoto = {
    image: button.dataset.galleryImage,
    ditheredImage: button.dataset.galleryDitheredImage,
    captionEn: button.dataset.galleryCaptionEn,
    captionJa: button.dataset.galleryCaptionJa,
  };
  updateGalleryViewerPhoto();
  galleryViewerSlot.classList.remove('is-closed');
  galleryViewerDialog.classList.remove('is-closed', 'window-shaded');
  galleryViewerDialog.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function closeGalleryViewer() {
  if (!galleryViewerSlot || !galleryViewerDialog || !galleryViewerImage || !galleryViewerCaption) {
    return;
  }

  galleryViewerSlot.classList.add('is-closed');
  galleryViewerDialog.classList.remove('window-shaded');
  galleryViewerDialog.classList.add('is-closed');
  galleryViewerImage.removeAttribute('src');
  galleryViewerImage.alt = '';
  galleryViewerImage.classList.remove('is-dithered');
  galleryViewerCaption.textContent = '';
  if (galleryViewerTitle) {
    galleryViewerTitle.textContent = localizedText('Photo Viewer', '写真ビューア');
  }
  currentGalleryPhoto = null;
}

function openQrCodeWindow() {
  if (!qrCodeSlot || !qrCodeDialog) {
    return;
  }

  qrCodeSlot.classList.remove('is-closed');
  qrCodeDialog.classList.remove('is-closed', 'window-shaded');
  qrCodeDialog.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function closeQrCodeWindow() {
  if (!qrCodeSlot || !qrCodeDialog) {
    return;
  }

  qrCodeSlot.classList.add('is-closed');
  qrCodeDialog.classList.remove('window-shaded');
  qrCodeDialog.classList.add('is-closed');
}

function preventPageDoubleTapZoom(event) {
  if (event.changedTouches.length !== 1) {
    return;
  }

  const touch = event.changedTouches[0];
  const now = performance.now();
  const wasDoubleTap = lastPageTap
    && now - lastPageTap.time < MAP_DOUBLE_TAP_MS
    && Math.hypot(touch.clientX - lastPageTap.clientX, touch.clientY - lastPageTap.clientY) < MAP_DOUBLE_TAP_DISTANCE;

  if (wasDoubleTap) {
    if (event.cancelable) {
      event.preventDefault();
    }
    const titleBar = event.target.closest?.('.title-bar, .clock-title-bar');
    if (titleBar) {
      const windowElement = titleBar.closest('.mac-dialog, .clock-widget');
      lastTouchWindowShadeAt = now;
      toggleWindowShade(windowElement);
    }
    lastPageTap = null;
    return;
  }

  lastPageTap = { time: now, clientX: touch.clientX, clientY: touch.clientY };
}

document.addEventListener('touchend', preventPageDoubleTapZoom, { passive: false });

function getMapPoint(clientX, clientY) {
  if (!worldMapFrame || !worldMapLayer) {
    return null;
  }

  const layerRect = worldMapLayer.getBoundingClientRect();
  const x = clamp(clientX - layerRect.left, 0, layerRect.width);
  const y = clamp(clientY - layerRect.top, 0, layerRect.height);
  return {
    pinXPercent: (x / layerRect.width) * 100,
    pinYPercent: (y / layerRect.height) * 100,
  };
}

function getOuterMapClientPoint(event) {
  if (event.view === window || !worldMapObject) {
    return { clientX: event.clientX, clientY: event.clientY };
  }

  const objectRect = worldMapObject.getBoundingClientRect();
  return {
    clientX: objectRect.left + event.clientX,
    clientY: objectRect.top + event.clientY,
  };
}

function getCountryGroup(target) {
  const group = target?.closest?.('g[id]');
  if (!group || !/^[A-Z]{2}$/.test(group.id)) {
    return null;
  }

  return group;
}

function getSvgElementClientCenter(element) {
  const svg = element?.ownerSVGElement || element;
  const viewBox = svg?.viewBox?.baseVal;
  if (!element?.getBBox || !viewBox || !worldMapObject) {
    return null;
  }

  const box = element.getBBox();
  if (!box.width && !box.height) {
    return null;
  }

  const objectRect = worldMapObject.getBoundingClientRect();
  return {
    clientX: objectRect.left + ((box.x + box.width / 2 - viewBox.x) / viewBox.width) * objectRect.width,
    clientY: objectRect.top + ((box.y + box.height / 2 - viewBox.y) / viewBox.height) * objectRect.height,
  };
}

function getCountryPinPoint(countryGroup, eventTarget, fallbackPoint) {
  const countryShape = eventTarget?.closest?.('path,circle,ellipse,polygon,rect');
  const pinTarget = countryShape && countryGroup?.contains(countryShape)
    ? countryShape
    : countryGroup;
  return getSvgElementClientCenter(pinTarget) || fallbackPoint;
}

function updateMapStatus(text) {
  if (mapLocationStatus) {
    mapLocationStatus.textContent = text;
  }
}

function createSubmissionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanGuestbookName(value) {
  return (value || 'Anonymous').replace(/\s+/g, ' ').trim().slice(0, 18) || 'Anonymous';
}

function cleanSubmissionText(value, maxLength) {
  return (value || '')
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function submissionDefinition(kind, context = {}) {
  const commonName = {
    name: 'name',
    label: localizedText('Your name', 'お名前'),
    maxLength: 50,
    placeholder: localizedText('Anonymous', '匿名'),
  };
  if (kind === 'guestbook') {
    return {
      title: localizedText('Sign the guestbook', 'ゲストブックに署名'),
      endpoint: '/api/submissions/guestbook',
      fields: [
        { ...commonName, maxLength: 18 },
        {
          name: 'comment',
          label: localizedText('Comment (optional)', 'コメント（任意）'),
          maxLength: 120,
          multiline: true,
        },
      ],
      payload(values) {
        return {
          id: createSubmissionId(),
          name: cleanGuestbookName(values.name),
          countryCode: context.countryCode,
          countryName: context.countryName,
          comment: cleanSubmissionText(values.comment, 120),
          signedAt: new Date().toISOString(),
        };
      },
    };
  }
  if (kind === 'tokyo-recommendation') {
    return {
      title: localizedText('Add Tokyo recommendation', 'Tokyoおすすめを追加'),
      endpoint: '/api/submissions/tokyo-recommendation',
      fields: [
        {
          name: 'recommendation',
          label: localizedText('What do you recommend?', 'おすすめは何ですか？'),
          maxLength: 80,
          required: true,
        },
        { ...commonName, maxLength: 18 },
        {
          name: 'comment',
          label: localizedText('Comment (optional)', 'コメント（任意）'),
          maxLength: 140,
          multiline: true,
        },
      ],
      payload(values) {
        return {
          id: createSubmissionId(),
          name: cleanGuestbookName(values.name),
          recommendation: cleanSubmissionText(values.recommendation, 80),
          comment: cleanSubmissionText(values.comment, 140),
          submittedAt: new Date().toISOString(),
        };
      },
    };
  }
  if (kind === 'mud-score') {
    return {
      title: localizedText('Submit UENO QUEST score', 'UENO QUESTスコアを送信'),
      endpoint: '/api/submissions/mud-score',
      fields: [{ ...commonName, maxLength: 18 }],
      payload(values) {
        const moves = Number(context.moves);
        const sideQuests = Array.isArray(context.sideQuests) ? context.sideQuests : [];
        const sideQuestCount = sideQuests.length;
        return {
          id: createSubmissionId(),
          name: cleanGuestbookName(values.name),
          moves,
          sideQuests,
          sideQuestCount,
          rank: moves <= 14 ? 'Senior Soba Engineer' : sideQuestCount >= 4 ? 'Tokyo Completionist' : 'Soba Engineer',
          route: 'Ueno -> Otemachi -> Shibuya -> Ueno',
          completedAt: context.completedAt || new Date().toISOString(),
        };
      },
    };
  }
  if (kind === 'contact') {
    const categoryLabels = {
      'app-idea': localizedText('Share an app idea', 'アプリのアイデアを送る'),
      tokyo: localizedText('Share a Tokyo recommendation', 'Tokyoのおすすめを送る'),
      running: localizedText('Send a running message', 'ランニングについて送る'),
    };
    return {
      title: categoryLabels[context.category] || localizedText('Send a message', 'メッセージを送る'),
      endpoint: '/api/contact',
      fields: [
        commonName,
        {
          name: 'email',
          label: localizedText('Reply email (optional)', '返信先メール（任意）'),
          maxLength: 254,
          type: 'email',
        },
        {
          name: 'message',
          label: localizedText('Message', 'メッセージ'),
          maxLength: 2000,
          required: true,
          multiline: true,
        },
      ],
      payload(values) {
        return {
          id: createSubmissionId(),
          category: context.category,
          name: cleanSubmissionText(values.name, 50) || 'Anonymous',
          email: cleanSubmissionText(values.email, 254),
          message: cleanSubmissionText(values.message, 2000),
        };
      },
    };
  }
  return null;
}

function createSubmissionField(field) {
  const label = document.createElement('label');
  label.textContent = field.label;
  const input = document.createElement(field.multiline ? 'textarea' : 'input');
  input.name = field.name;
  input.maxLength = field.maxLength;
  input.required = Boolean(field.required);
  if (!field.multiline) {
    input.type = field.type || 'text';
  }
  if (field.placeholder) {
    input.placeholder = field.placeholder;
  }
  label.append(input);
  return label;
}

function setSubmissionStatus(message, isError = false) {
  if (!submissionStatus) return;
  submissionStatus.textContent = message;
  submissionStatus.classList.toggle('is-error', isError);
}

function removeSubmissionTurnstile() {
  if (submissionTurnstileWidgetId !== null && window.turnstile) {
    window.turnstile.remove(submissionTurnstileWidgetId);
  }
  submissionTurnstileWidgetId = null;
  submissionTurnstileToken = '';
  if (submissionTurnstile) {
    submissionTurnstile.textContent = '';
  }
}

async function renderSubmissionTurnstile() {
  if (!TURNSTILE_SITE_KEY) {
    setSubmissionStatus(localizedText('Submission service is not configured yet.', '送信サービスはまだ設定されていません。'), true);
    return;
  }
  for (let attempt = 0; attempt < 50 && !window.turnstile; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  if (!window.turnstile || !submissionTurnstile) {
    setSubmissionStatus(localizedText('Human verification could not load.', '本人確認を読み込めませんでした。'), true);
    return;
  }
  submissionTurnstileWidgetId = window.turnstile.render(submissionTurnstile, {
    sitekey: TURNSTILE_SITE_KEY,
    theme: 'auto',
    action: 'portfolio-submission',
    callback(token) {
      submissionTurnstileToken = token;
      setSubmissionStatus('');
    },
    'expired-callback'() {
      submissionTurnstileToken = '';
    },
    'error-callback'() {
      submissionTurnstileToken = '';
      setSubmissionStatus(localizedText('Human verification failed to load.', '本人確認の読み込みに失敗しました。'), true);
    },
  });
}

function closeSubmissionDialog() {
  if (!submissionOverlay) return;
  submissionOverlay.hidden = true;
  activeSubmission = null;
  submissionForm?.reset();
  removeSubmissionTurnstile();
}

function openPortfolioSubmission(kind, context = {}) {
  const definition = submissionDefinition(kind, context);
  if (!definition || !submissionOverlay || !submissionForm || !submissionFields) {
    return;
  }
  activeSubmission = { kind, context, definition };
  submissionTitle.textContent = definition.title;
  submissionFields.textContent = '';
  definition.fields.forEach((field) => submissionFields.append(createSubmissionField(field)));
  submissionOverlay.hidden = false;
  submissionSubmitButton.disabled = !PORTFOLIO_API_BASE_URL || !TURNSTILE_SITE_KEY;
  setSubmissionStatus('');
  renderSubmissionTurnstile();
  submissionFields.querySelector('input, textarea')?.focus();
}

window.openPortfolioSubmission = openPortfolioSubmission;

submissionForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeSubmission || !submissionTurnstileToken) {
    setSubmissionStatus(localizedText('Complete the human verification first.', '先に本人確認を完了してください。'), true);
    return;
  }
  const values = Object.fromEntries(new FormData(submissionForm).entries());
  const payload = activeSubmission.definition.payload(values);
  submissionSubmitButton.disabled = true;
  setSubmissionStatus(localizedText('Sending…', '送信中…'));
  try {
    const response = await fetch(`${PORTFOLIO_API_BASE_URL}${activeSubmission.definition.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, turnstileToken: submissionTurnstileToken }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `Request failed: ${response.status}`);
    }
    document.dispatchEvent(new CustomEvent('portfolio-submission-accepted', {
      detail: { kind: activeSubmission.kind, payload, result },
    }));
    setSubmissionStatus(activeSubmission.kind === 'contact'
      ? localizedText('Message received. Thank you!', 'メッセージを受け取りました。ありがとうございます！')
      : localizedText('Submitted for approval. Thank you!', '承認待ちとして送信しました。ありがとうございます！'));
    window.setTimeout(closeSubmissionDialog, 1200);
  } catch (error) {
    setSubmissionStatus(error.message || localizedText('Submission failed.', '送信に失敗しました。'), true);
    submissionSubmitButton.disabled = false;
    if (window.turnstile && submissionTurnstileWidgetId !== null) {
      window.turnstile.reset(submissionTurnstileWidgetId);
      submissionTurnstileToken = '';
    }
  }
});

submissionCloseButton?.addEventListener('click', closeSubmissionDialog);
submissionCancelButton?.addEventListener('click', closeSubmissionDialog);
submissionOverlay?.addEventListener('click', (event) => {
  if (event.target === submissionOverlay) closeSubmissionDialog();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && submissionOverlay && !submissionOverlay.hidden) {
    closeSubmissionDialog();
  }
});
contactSubmissionLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    openPortfolioSubmission('contact', { category: link.dataset.contactCategory });
  });
});

function getRegionName(countryCode) {
  try {
    const displayNames = new Intl.DisplayNames([document.documentElement.lang || 'en'], { type: 'region' });
    return displayNames.of(countryCode) || countryCode;
  } catch (error) {
    return countryCode;
  }
}

function renderTokyoRecommendations() {
  if (!tokyoRecommendationsListElement) {
    return;
  }

  if (!tokyoRecommendations.length) {
    tokyoRecommendationsListElement.textContent = localizedText(
      'Tokyo recommendations: none public yet.',
      'Tokyoおすすめ: まだ公開されていません。'
    );
    return;
  }

  tokyoRecommendationsListElement.textContent = '';

  const summaryElement = document.createElement('div');
  summaryElement.className = 'tokyo-recommendations-summary';
  summaryElement.textContent = localizedText('Tokyo recommendations:', 'Tokyoおすすめ:');
  tokyoRecommendationsListElement.append(summaryElement);

  const list = document.createElement('ul');
  list.className = 'tokyo-recommendations-entries';
  tokyoRecommendations.slice(0, 4).forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = entry.comment
      ? `${entry.recommendation} - ${entry.comment} (${entry.name})`
      : `${entry.recommendation} (${entry.name})`;
    list.append(item);
  });
  tokyoRecommendationsListElement.append(list);
}

async function fetchTokyoRecommendations() {
  if (!tokyoRecommendationsListElement) {
    return;
  }

  try {
    tokyoRecommendations = await fetchPortfolioEntries(
      '/api/content/tokyo-recommendations',
      TOKYO_RECOMMENDATIONS_FALLBACK_URL,
    );
  } catch (error) {
    tokyoRecommendations = [];
  }
  renderTokyoRecommendations();
}

async function fetchPortfolioEntries(apiPath, fallbackUrl) {
  if (PORTFOLIO_API_BASE_URL) {
    try {
      const response = await fetch(`${PORTFOLIO_API_BASE_URL}${apiPath}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`API request failed: ${response.status}`);
      const data = await response.json();
      return Array.isArray(data.entries) ? data.entries : [];
    } catch (error) {
      // Preserve the checked-in snapshot as a read-only fallback during rollout.
    }
  }
  const fallbackResponse = await fetch(fallbackUrl, { cache: 'no-store' });
  if (!fallbackResponse.ok) throw new Error(`Fallback request failed: ${fallbackResponse.status}`);
  const fallbackData = await fallbackResponse.json();
  return Array.isArray(fallbackData.entries) ? fallbackData.entries : [];
}

function renderGuestbook() {
  if (!guestbookListElement) {
    return;
  }

  if (!guestbookEntries.length) {
    guestbookListElement.textContent = localizedText(
      'Guestbook: no public entries yet.',
      'ゲストブック: まだ公開エントリーはありません。'
    );
    return;
  }

  const recentEntries = guestbookEntries.slice(0, 5);
  const countryCount = new Set(guestbookEntries.map((entry) => entry.countryCode).filter(Boolean)).size;
  const summary = localizedText(
    `Signed from ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}:`,
    `${countryCount}か国から:`
  );
  guestbookListElement.textContent = '';

  const summaryElement = document.createElement('div');
  summaryElement.className = 'guestbook-summary';
  summaryElement.textContent = summary;
  guestbookListElement.append(summaryElement);

  const list = document.createElement('ul');
  list.className = 'guestbook-entries';
  recentEntries.forEach((entry) => {
    const item = document.createElement('li');
    const place = entry.countryName || entry.countryCode;
    item.textContent = entry.comment
      ? `${entry.name} - ${place}: ${entry.comment}`
      : `${entry.name} - ${place}`;
    list.append(item);
  });
  guestbookListElement.append(list);
}

async function fetchGuestbook() {
  if (!guestbookListElement) {
    return;
  }

  try {
    guestbookEntries = await fetchPortfolioEntries('/api/content/guestbook', GUESTBOOK_FALLBACK_URL);
  } catch (error) {
    guestbookEntries = [];
  }
  renderGuestbook();
}

function placeMapPin(countryGroup, eventTarget, fallbackPoint) {
  const pinPoint = getCountryPinPoint(countryGroup, eventTarget, fallbackPoint);
  const point = pinPoint ? getMapPoint(pinPoint.clientX, pinPoint.clientY) : null;
  if (!point || !countryGroup || !selectedMapPin || !mapEmailButton) {
    updateMapStatus('Pick your country first.');
    return;
  }

  selectedMapCountryElement?.classList.remove('is-selected');
  selectedMapCountryCode = countryGroup.id;
  selectedMapPlace = getRegionName(selectedMapCountryCode);
  selectedMapCountryElement = countryGroup;
  selectedMapCountryElement.classList.add('is-selected');
  selectedMapPin.hidden = false;
  selectedMapPin.style.left = `${point.pinXPercent}%`;
  selectedMapPin.style.top = `${point.pinYPercent}%`;
  mapEmailButton.disabled = false;
  updateMapStatus(selectedMapPlace);
}

function setMapTransform() {
  if (!worldMapFrame) {
    return;
  }

  const rect = worldMapFrame.getBoundingClientRect();
  const maxPanX = (rect.width * (mapZoom - 1)) / 2;
  const maxPanY = (rect.height * (mapZoom - 1)) / 2;
  mapPanX = clamp(mapPanX, -maxPanX, maxPanX);
  mapPanY = clamp(mapPanY, -maxPanY, maxPanY);
  worldMapFrame.style.setProperty('--map-zoom', mapZoom);
  worldMapFrame.style.setProperty('--map-pin-scale', 1 / mapZoom);
  worldMapFrame.style.setProperty('--map-pan-x', `${mapPanX}px`);
  worldMapFrame.style.setProperty('--map-pan-y', `${mapPanY}px`);
  worldMapFrame.classList.toggle('is-zoomed', mapZoom > 1);
}

function setMapZoom(nextZoom, focusPoint = null) {
  const previousZoom = mapZoom;
  mapZoom = clamp(nextZoom, 1, 4);
  if (mapZoom === 1) {
    mapPanX = 0;
    mapPanY = 0;
  } else if (previousZoom > 0 && focusPoint && worldMapFrame) {
    const rect = worldMapFrame.getBoundingClientRect();
    const ratio = mapZoom / previousZoom;
    const focusX = focusPoint.clientX - rect.left - rect.width / 2;
    const focusY = focusPoint.clientY - rect.top - rect.height / 2;
    mapPanX = mapPanX * ratio + focusX * (1 - ratio);
    mapPanY = mapPanY * ratio + focusY * (1 - ratio);
  } else if (previousZoom > 0) {
    const ratio = mapZoom / previousZoom;
    mapPanX *= ratio;
    mapPanY *= ratio;
  }
  setMapTransform();
}

function isMapDoubleTap(point) {
  const now = performance.now();
  const wasDoubleTap = lastMapTap
    && now - lastMapTap.time < MAP_DOUBLE_TAP_MS
    && Math.hypot(point.clientX - lastMapTap.clientX, point.clientY - lastMapTap.clientY) < MAP_DOUBLE_TAP_DISTANCE;

  lastMapTap = wasDoubleTap ? null : { time: now, clientX: point.clientX, clientY: point.clientY };
  return wasDoubleTap;
}

function captureMapPointer(pointerId) {
  try {
    worldMapFrame?.setPointerCapture?.(pointerId);
  } catch (error) {
    // Synthetic pointer events used by test tools do not always create an active pointer.
  }
}

function releaseMapPointer(pointerId) {
  try {
    worldMapFrame?.releasePointerCapture?.(pointerId);
  } catch (error) {
    // Ignore stale pointer capture state after cancelled drags.
  }
}

mapZoomInButton?.addEventListener('click', () => {
  setMapZoom(mapZoom + 0.5);
  mapZoomInButton.blur();
});

mapZoomOutButton?.addEventListener('click', () => {
  setMapZoom(mapZoom - 0.5);
  mapZoomOutButton.blur();
});

function openMapSubmission() {
  if (!selectedMapPlace || !selectedMapCountryCode) {
    updateMapStatus('Pick your country first.');
    return;
  }

  openPortfolioSubmission('guestbook', {
    countryCode: selectedMapCountryCode,
    countryName: selectedMapPlace,
  });
}

mapEmailButton?.addEventListener('click', () => {
  openMapSubmission();
  mapEmailButton.blur();
});

function handleMapPointerDown(event) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  const point = getOuterMapClientPoint(event);
  mapPointerStart = {
    clientX: point.clientX,
    clientY: point.clientY,
    panX: mapPanX,
    panY: mapPanY,
    didPan: false,
  };
  captureMapPointer(event.pointerId);
  worldMapFrame.classList.toggle('is-panning', mapZoom > 1);
}

function handleMapPointerMove(event) {
  if (!mapPointerStart || mapZoom <= 1) {
    return;
  }

  event.preventDefault();
  const point = getOuterMapClientPoint(event);
  const dx = point.clientX - mapPointerStart.clientX;
  const dy = point.clientY - mapPointerStart.clientY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    mapPointerStart.didPan = true;
  }
  mapPanX = mapPointerStart.panX + dx;
  mapPanY = mapPointerStart.panY + dy;
  setMapTransform();
}

function handleMapPointerUp(event) {
  if (!mapPointerStart) {
    return;
  }

  event.preventDefault();
  releaseMapPointer(event.pointerId);
  worldMapFrame.classList.remove('is-panning');
  const point = getOuterMapClientPoint(event);
  const dx = point.clientX - mapPointerStart.clientX;
  const dy = point.clientY - mapPointerStart.clientY;
  const didPan = mapPointerStart.didPan || Math.hypot(dx, dy) > 6;
  mapPointerStart = null;
  suppressMapClick = true;
  setTimeout(() => {
    suppressMapClick = false;
  }, 0);

  if (!didPan) {
    if (isMapDoubleTap(point)) {
      setMapZoom(mapZoom + 0.5, point);
      return;
    }

    placeMapPin(getCountryGroup(event.target), event.target, point);
  }
}

function handleMapPointerCancel(event) {
  releaseMapPointer(event.pointerId);
  worldMapFrame.classList.remove('is-panning');
  mapPointerStart = null;
}

function handleMapClick(event) {
  if (suppressMapClick) {
    return;
  }

  const point = getOuterMapClientPoint(event);
  placeMapPin(getCountryGroup(event.target), event.target, point);
}

function handleMapTouchMove(event) {
  if (mapZoom <= 1 || !event.cancelable) {
    return;
  }

  event.preventDefault();
}

function wireMapPointerTarget(target) {
  if (!target || target.__worldMapWired) {
    return;
  }

  target.__worldMapWired = true;
  target.addEventListener('pointerdown', handleMapPointerDown);
  target.addEventListener('pointermove', handleMapPointerMove);
  target.addEventListener('pointerup', handleMapPointerUp);
  target.addEventListener('pointercancel', handleMapPointerCancel);
  target.addEventListener('click', handleMapClick);
  target.addEventListener('touchmove', handleMapTouchMove, { passive: false });
}

function prepareMapSvg() {
  const svgDocument = worldMapObject?.contentDocument;
  const svg = svgDocument?.documentElement;
  if (!svg) {
    return;
  }

  const isModern = document.documentElement.dataset.theme === 'modern';
  let style = svgDocument.getElementById('world-map-interaction-style');
  if (!style) {
    style = svgDocument.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.id = 'world-map-interaction-style';
    svg.insertBefore(style, svg.firstChild);
  }

  style.textContent = `
    #World, #Ocean { fill: transparent; stroke: none; }
    g[id] { cursor: pointer; }
    g[id] path { fill: ${isModern ? '#1d1d1f' : '#000'}; stroke: ${isModern ? 'rgba(255, 255, 255, 0.45)' : '#333'}; stroke-width: ${isModern ? '0.35' : '0.5'}; }
    g[id].is-selected path { stroke: #fff; stroke-width: 1.2; }
    text { display: none; }
  `;
  svg.setAttribute('focusable', 'false');
  wireMapPointerTarget(svgDocument);
}

wireMapPointerTarget(worldMapFrame);
worldMapObject?.addEventListener('load', prepareMapSvg);

worldMapFrame?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  updateMapStatus('Pick your country first.');
});

stackPrevButton?.addEventListener('click', () => {
  showRelativeStackCard(-1);
  stackPrevButton.blur();
});

stackNextButton?.addEventListener('click', () => {
  showRelativeStackCard(1);
  stackNextButton.blur();
});

document.querySelectorAll('[data-stack-jump]').forEach((button) => {
  button.addEventListener('click', () => {
    showStackCard(Number(button.dataset.stackJump));
    button.blur();
  });
});

hypercardStack?.addEventListener('touchstart', (event) => {
  const touch = event.changedTouches[0];
  stackTouchStartX = touch.clientX;
  stackTouchStartY = touch.clientY;
}, { passive: true });

hypercardStack?.addEventListener('touchend', (event) => {
  if (stackTouchStartX === null || stackTouchStartY === null) {
    return;
  }

  const touch = event.changedTouches[0];
  const dx = touch.clientX - stackTouchStartX;
  const dy = touch.clientY - stackTouchStartY;
  stackTouchStartX = null;
  stackTouchStartY = null;

  if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) {
    return;
  }

  showRelativeStackCard(dx < 0 ? 1 : -1);
}, { passive: true });

hypercardStack?.addEventListener('animationend', (event) => {
  if (event.target.classList.contains('stack-card')) {
    clearStackTransition();
  }
});

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getRect(element) {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function getAboutIconRect() {
  const icon = aboutDesktopIcon.querySelector('.desktop-icon-image') || aboutDesktopIcon;
  return getRect(icon);
}

function getAboutIconTargetRect(slotHeight) {
  const icon = aboutDesktopIcon.querySelector('.desktop-icon-image') || aboutDesktopIcon;
  const wasIconHidden = aboutDesktopIcon.hidden;
  const previousMinHeight = aboutSlot.style.minHeight;

  if (slotHeight) {
    aboutSlot.style.minHeight = `${slotHeight}px`;
  }

  aboutSlot.classList.add('is-measuring-icon');
  aboutDesktopIcon.hidden = false;
  aboutDesktopIcon.style.visibility = 'hidden';
  aboutDesktopIcon.style.pointerEvents = 'none';

  const rect = getRect(icon);

  aboutDesktopIcon.style.visibility = '';
  aboutDesktopIcon.style.pointerEvents = '';
  aboutSlot.classList.remove('is-measuring-icon');
  aboutDesktopIcon.hidden = wasIconHidden;
  aboutSlot.style.minHeight = previousMinHeight;

  return rect;
}

function getCollapsedAboutRect() {
  const dialogRect = aboutDialog.getBoundingClientRect();
  const titleBarRect = aboutDialog.querySelector('.title-bar').getBoundingClientRect();
  return {
    left: dialogRect.left,
    top: dialogRect.top,
    width: dialogRect.width,
    height: titleBarRect.bottom - dialogRect.top,
  };
}

function measureExpandedAboutSlotHeight() {
  const wasClosed = aboutDialog.classList.contains('is-closed');
  const wasShaded = aboutDialog.classList.contains('window-shaded');
  const wasIconHidden = aboutDesktopIcon.hidden;

  aboutDialog.classList.remove('is-closed', 'window-shaded');
  aboutSlot.classList.remove('is-closed', 'is-shaded');
  aboutDesktopIcon.hidden = true;

  const height = aboutSlot.offsetHeight;

  if (wasClosed) {
    aboutDialog.classList.add('is-closed');
    aboutSlot.classList.add('is-closed');
    aboutDesktopIcon.hidden = false;
  } else {
    aboutDesktopIcon.hidden = wasIconHidden;
  }
  if (wasShaded) {
    aboutDialog.classList.add('window-shaded');
    aboutSlot.classList.add('is-shaded');
  }

  return height;
}

function measureExpandedAboutRect() {
  const wasClosed = aboutDialog.classList.contains('is-closed');
  const wasShaded = aboutDialog.classList.contains('window-shaded');

  aboutDialog.classList.remove('is-closed', 'window-shaded');
  aboutSlot.classList.remove('is-closed', 'is-shaded');
  aboutDialog.classList.add('is-zoom-hidden');

  const rect = getRect(aboutDialog);

  aboutDialog.classList.remove('is-zoom-hidden');
  if (wasClosed) {
    aboutDialog.classList.add('is-closed');
    aboutSlot.classList.add('is-closed');
  }
  if (wasShaded) {
    aboutDialog.classList.add('window-shaded');
    aboutSlot.classList.add('is-shaded');
  }

  return rect;
}

function runZoomAnimation(from, to, duration, onComplete) {
  if (!windowZoomRect || prefersReducedMotion()) {
    onComplete?.();
    return;
  }

  isWindowAnimating = true;
  windowZoomRect.hidden = false;
  windowZoomRect.style.left = `${from.left}px`;
  windowZoomRect.style.top = `${from.top}px`;
  windowZoomRect.style.width = `${from.width}px`;
  windowZoomRect.style.height = `${from.height}px`;

  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    windowZoomRect.style.left = `${from.left + (to.left - from.left) * progress}px`;
    windowZoomRect.style.top = `${from.top + (to.top - from.top) * progress}px`;
    windowZoomRect.style.width = `${from.width + (to.width - from.width) * progress}px`;
    windowZoomRect.style.height = `${from.height + (to.height - from.height) * progress}px`;

    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }

    windowZoomRect.hidden = true;
    isWindowAnimating = false;
    onComplete?.();
  }

  requestAnimationFrame(frame);
}

function storeExpandedAboutHeight() {
  if (!aboutDialog.classList.contains('is-closed') && !aboutDialog.classList.contains('window-shaded')) {
    expandedAboutHeight = aboutSlot.offsetHeight;
  }
}

function updateAboutShadeLayout() {
  if (aboutDialog.classList.contains('is-closed')) {
    return;
  }

  if (aboutDialog.classList.contains('window-shaded')) {
    if (!expandedAboutHeight) {
      expandedAboutHeight = aboutSlot.offsetHeight;
    }
    aboutSlot.classList.add('is-shaded');
    aboutSlot.style.minHeight = `${expandedAboutHeight}px`;
    aboutDesktopIcon.hidden = false;
  } else {
    aboutSlot.classList.remove('is-shaded');
    aboutSlot.style.minHeight = '';
    aboutDesktopIcon.hidden = true;
    storeExpandedAboutHeight();
  }
}

function applyOpenAboutState({ retainMinHeight = false } = {}) {
  aboutDialog.classList.remove('is-closed', 'window-shaded', 'is-zoom-hidden');
  aboutSlot.classList.remove('is-closed', 'is-shaded');
  if (!retainMinHeight) {
    aboutSlot.style.minHeight = '';
  }
  aboutDesktopIcon.hidden = true;
  if (!retainMinHeight) {
    storeExpandedAboutHeight();
  }
}

function applyCloseAboutState(slotHeight) {
  closeDesktopBrowser();
  closeGalleryViewer();
  closeQrCodeWindow();
  aboutDialog.classList.remove('window-shaded', 'is-zoom-hidden');
  aboutSlot.classList.remove('is-shaded');
  aboutDialog.classList.add('is-closed');
  aboutSlot.classList.add('is-closed');
  aboutSlot.style.minHeight = `${slotHeight}px`;
  aboutDesktopIcon.hidden = false;
}

function getCloseSlotHeight() {
  if (!aboutSlot.style.minHeight) {
    storeExpandedAboutHeight();
  }

  return parseInt(aboutSlot.style.minHeight, 10)
    || expandedAboutHeight
    || aboutSlot.offsetHeight;
}

function openAboutWindow() {
  if (isWindowAnimating) {
    return;
  }

  if (prefersReducedMotion()) {
    applyOpenAboutState();
    return;
  }

  const from = getAboutIconRect();
  aboutDialog.classList.add('is-zoom-hidden');
  applyOpenAboutState({ retainMinHeight: true });
  const to = getRect(aboutDialog);
  aboutDialog.classList.add('is-zoom-hidden');

  runZoomAnimation(from, to, ZOOM_OPEN_MS, () => {
    aboutDialog.classList.remove('is-zoom-hidden');
    aboutSlot.style.minHeight = '';
    storeExpandedAboutHeight();
  });
}

function closeAboutWindow() {
  if (isWindowAnimating) {
    return;
  }

  const slotHeight = getCloseSlotHeight();

  if (prefersReducedMotion()) {
    applyCloseAboutState(slotHeight);
    return;
  }

  const from = aboutDialog.classList.contains('window-shaded')
    ? getCollapsedAboutRect()
    : getRect(aboutDialog);
  const to = getAboutIconTargetRect(slotHeight);

  aboutDialog.classList.add('is-zoom-hidden');

  runZoomAnimation(from, to, ZOOM_CLOSE_MS, () => {
    applyCloseAboutState(slotHeight);
  });
}

function shadeAboutWindow() {
  if (isWindowAnimating) {
    return;
  }

  expandedAboutHeight = aboutSlot.offsetHeight;

  if (prefersReducedMotion()) {
    aboutDialog.classList.add('window-shaded');
    updateAboutShadeLayout();
    return;
  }

  const from = getRect(aboutDialog);
  const to = getCollapsedAboutRect();

  aboutDialog.classList.add('is-zoom-hidden');

  runZoomAnimation(from, to, ZOOM_SHADE_MS, () => {
    aboutDialog.classList.remove('is-zoom-hidden');
    aboutDialog.classList.add('window-shaded');
    updateAboutShadeLayout();
  });
}

function unshadeAboutWindow() {
  if (isWindowAnimating) {
    return;
  }

  if (prefersReducedMotion()) {
    aboutDialog.classList.remove('window-shaded');
    updateAboutShadeLayout();
    return;
  }

  const from = getCollapsedAboutRect();
  const to = measureExpandedAboutRect();

  aboutDialog.classList.add('is-zoom-hidden');

  runZoomAnimation(from, to, ZOOM_SHADE_MS, () => {
    aboutDialog.classList.remove('window-shaded', 'is-zoom-hidden');
    updateAboutShadeLayout();
    storeExpandedAboutHeight();
  });
}

function toggleWindowShade(windowElement) {
  if (!windowElement) {
    return;
  }

  if (windowElement === aboutDialog) {
    if (aboutDialog.classList.contains('is-closed')) {
      return;
    }

    if (aboutDialog.classList.contains('window-shaded')) {
      unshadeAboutWindow();
    } else {
      shadeAboutWindow();
    }
    return;
  }

  windowElement.classList.toggle('window-shaded');
}

document.querySelectorAll('.title-bar, .clock-title-bar').forEach((titleBar) => {
  const windowElement = titleBar.closest('.mac-dialog, .clock-widget');
  if (!windowElement) return;

  titleBar.title = 'Double-click for WindowShade';
  titleBar.addEventListener('dblclick', () => {
    if (performance.now() - lastTouchWindowShadeAt < 500) {
      return;
    }
    toggleWindowShade(windowElement);
  });
});

aboutCloseButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  closeAboutWindow();
});

webBrowserCloseButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  closeDesktopBrowser();
});

galleryViewerCloseButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  closeGalleryViewer();
});

qrCodeCloseButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  closeQrCodeWindow();
});

qrCodeButton?.addEventListener('click', () => {
  openQrCodeWindow();
  qrCodeButton.blur();
});

galleryPhotoButtons.forEach((button) => {
  button.addEventListener('click', () => {
    openGalleryViewer(button);
    button.blur();
  });
});

webBrowserOpenExternalButton?.addEventListener('click', () => {
  if (currentWebBrowserUrl) {
    window.location.href = currentWebBrowserUrl;
  }
});

document.addEventListener('site-theme-change', () => {
  updateGalleryViewerPhoto();
});

document.addEventListener('site-language-change', () => {
  updateDesktopBrowserTitle();
  updateGalleryViewerPhoto();
});

document.addEventListener('click', (event) => {
  const link = event.target.closest?.('a[href]');
  if (!link || !shouldOpenInDesktopBrowser(link, event)) {
    return;
  }

  event.preventDefault();
  openDesktopBrowser(link.href, titleFromLink(link.href, link));
});

aboutDesktopIcon?.addEventListener('click', () => {
  if (aboutDialog.classList.contains('is-closed')) {
    openAboutWindow();
  } else if (aboutDialog.classList.contains('window-shaded')) {
    unshadeAboutWindow();
  }
});

function bootAboutWindow() {
  expandedAboutHeight = measureExpandedAboutSlotHeight();
  aboutSlot.style.minHeight = `${expandedAboutHeight}px`;

  if (prefersReducedMotion()) {
    openAboutWindow();
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        openAboutWindow();
      }, BOOT_ICON_PAUSE_MS);
    });
  });
}

const savedLanguage = localStorage.getItem('site-language');
const preferredLanguage = navigator.languages?.[0] || navigator.language || 'en';
const initialLanguage = savedLanguage || (preferredLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en');
shufflePuzzle();
setLanguage(initialLanguage);
updateStackCard();
setClockMode(getSavedClockMode());
setWeatherUnit(getSavedWeatherUnit());
initSiteTheme();
document.addEventListener('site-theme-change', () => {
  storeExpandedAboutHeight();
  prepareMapSvg();
});
window.addEventListener('resize', setMapTransform);
setMapTransform();
prepareMapSvg();
bootAboutWindow();
updateClocks();
fetchWeather();
fetchVisitorCount();
bindFeedScrollFade(xFeedElement);
fetchXSnapshot();
fetchGuestbook();
fetchTokyoRecommendations();
setInterval(updateClocks, 1000);
setInterval(fetchWeather, 30 * 60 * 1000);
