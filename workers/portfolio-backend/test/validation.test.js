import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ValidationError,
  mudRankForRun,
  validateContactMessage,
  validateGuestbook,
  validateMudScore,
  validateTokyoRecommendation,
} from '../src/validation.js';

test('guestbook validation cleans unsafe text and normalizes country codes', () => {
  const value = validateGuestbook({
    id: 'entry_1',
    name: '  Alice <script> ',
    countryCode: 'jp',
    countryName: ' Japan ',
    comment: 'Hello\u0000 <there>',
    signedAt: '2026-07-10T00:00:00Z',
  });
  assert.equal(value.name, 'Alice script');
  assert.equal(value.countryCode, 'JP');
  assert.equal(value.comment, 'Hello there');
});

test('Tokyo recommendations require recommendation text', () => {
  assert.throws(
    () => validateTokyoRecommendation({ name: 'Alice', recommendation: '   ' }),
    ValidationError,
  );
});

test('MUD scores recompute trusted rank and side quest count', () => {
  const value = validateMudScore({
    id: 'score-1',
    name: 'Bob',
    moves: 14,
    sideQuests: ['Visited Ueno Park', 'Visited Ueno Park'],
    rank: 'Hacker',
    route: 'Anywhere',
    completedAt: '2026-07-10T00:00:00Z',
  });
  assert.equal(value.sideQuestCount, 1);
  assert.equal(value.rank, 'Senior Soba Engineer');
  assert.equal(value.route, 'Ueno -> Otemachi -> Shibuya -> Ueno');
});

test('MUD rank favors completionist after the fastest tier', () => {
  assert.equal(mudRankForRun(20, 4), 'Tokyo Completionist');
  assert.equal(mudRankForRun(20, 1), 'Soba Engineer');
});

test('contact validation accepts only known categories and valid reply emails', () => {
  const value = validateContactMessage({
    id: 'contact-1',
    category: 'running',
    name: 'Runner',
    email: 'RUNNER@example.com',
    message: 'Let us run around Tokyo.',
  });
  assert.equal(value.email, 'runner@example.com');
  assert.throws(
    () => validateContactMessage({ category: 'other', message: 'Hi' }),
    ValidationError,
  );
});
