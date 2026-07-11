export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const CONTACT_CATEGORIES = new Set(['app-idea', 'tokyo', 'running']);
const MUD_SIDE_QUESTS = new Set([
  'Watered balcony plant',
  'Visited Ueno Park',
  'Helped lost tourist',
  'Refactored old code',
  'Asked event question',
  'Texted mom',
]);

export function cleanText(value, maxLength, { fallback = '', required = false } = {}) {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  const result = text || fallback;
  if (required && !result) {
    throw new ValidationError('A required field is missing.');
  }
  return result;
}

function cleanId(value) {
  const id = cleanText(value, 80);
  if (id && !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new ValidationError('The submission ID is invalid.');
  }
  return id || crypto.randomUUID();
}

function cleanIsoDate(value, fieldName) {
  const date = new Date(String(value ?? ''));
  if (!Number.isFinite(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid date.`);
  }
  if (date.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new ValidationError(`${fieldName} cannot be in the future.`);
  }
  return date.toISOString();
}

function cleanEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('The reply email address is invalid.');
  }
  return email;
}

export function validateGuestbook(body) {
  const countryCode = cleanText(body.countryCode, 2, { required: true }).toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new ValidationError('The country code is invalid.');
  }
  return {
    id: cleanId(body.id),
    name: cleanText(body.name, 18, { fallback: 'Anonymous' }),
    countryCode,
    countryName: cleanText(body.countryName, 80, { required: true }),
    comment: cleanText(body.comment, 120),
    signedAt: body.signedAt ? cleanIsoDate(body.signedAt, 'signedAt') : new Date().toISOString(),
  };
}

export function validateTokyoRecommendation(body) {
  return {
    id: cleanId(body.id),
    name: cleanText(body.name, 18, { fallback: 'Anonymous' }),
    recommendation: cleanText(body.recommendation, 80, { required: true }),
    comment: cleanText(body.comment, 140),
    submittedAt: body.submittedAt
      ? cleanIsoDate(body.submittedAt, 'submittedAt')
      : new Date().toISOString(),
  };
}

export function mudRankForRun(moves, sideQuestCount) {
  if (moves <= 14) return 'Senior Soba Engineer';
  if (sideQuestCount >= 4) return 'Tokyo Completionist';
  return 'Soba Engineer';
}

export function validateMudScore(body) {
  const moves = Number(body.moves);
  if (!Number.isInteger(moves) || moves < 1 || moves > 999) {
    throw new ValidationError('Moves must be an integer from 1 to 999.');
  }
  const sideQuests = Array.isArray(body.sideQuests)
    ? [...new Set(body.sideQuests.map((value) => cleanText(value, 80)).filter(Boolean))]
    : [];
  if (sideQuests.length > MUD_SIDE_QUESTS.size || sideQuests.some((value) => !MUD_SIDE_QUESTS.has(value))) {
    throw new ValidationError('One or more side quests are invalid.');
  }
  return {
    id: cleanId(body.id),
    name: cleanText(body.name, 18, { fallback: 'Anonymous' }),
    moves,
    sideQuests,
    sideQuestCount: sideQuests.length,
    rank: mudRankForRun(moves, sideQuests.length),
    route: 'Ueno -> Otemachi -> Shibuya -> Ueno',
    completedAt: body.completedAt
      ? cleanIsoDate(body.completedAt, 'completedAt')
      : new Date().toISOString(),
  };
}

export function validateContactMessage(body) {
  const category = cleanText(body.category, 30, { required: true });
  if (!CONTACT_CATEGORIES.has(category)) {
    throw new ValidationError('The message category is invalid.');
  }
  return {
    id: cleanId(body.id),
    category,
    name: cleanText(body.name, 50, { fallback: 'Anonymous' }),
    email: cleanEmail(body.email),
    message: cleanText(body.message, 2000, { required: true }),
    submittedAt: new Date().toISOString(),
  };
}

export function validateCounterKey(siteValue, pathValue) {
  const site = cleanText(siteValue, 120, { required: true }).toLowerCase();
  const path = cleanText(pathValue, 200, { required: true });
  if (!/^[a-z0-9.-]+$/.test(site) || !path.startsWith('/')) {
    throw new ValidationError('The counter key is invalid.');
  }
  return { site, path };
}
