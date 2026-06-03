/**
 * Google Apps Script: approved Gmail submissions -> GitHub PRs.
 *
 * Setup:
 * 1. Create Gmail labels:
 *    - site-processed
 *    - site-error
 *    These are created automatically if missing.
 * 2. Create a fine-grained GitHub token with access to this repo and:
 *    - Contents: read/write
 *    - Pull requests: read/write
 *    - Metadata: read
 * 3. In Apps Script, set Script Property GITHUB_TOKEN to that token.
 * 4. Add a time-driven trigger for processApprovedSiteSubmissions.
 * 5. Review and approve/close the generated PRs in GitHub.
 *
 * To add another submission type, add a handler to SUBMISSION_HANDLERS.
 * The handler owns validation and PR content; the shared code handles Gmail,
 * labels, JSON extraction, GitHub commits, and PR creation.
 */

const LABEL_CONFIG = {
  PROCESSED: 'site-processed',
  ERROR: 'site-error',
};

const GITHUB_CONFIG = {
  OWNER: 'littlebobert',
  REPO: 'littlebobert.github.io',
  BASE_BRANCH: 'master',
  TOKEN_PROPERTY: 'GITHUB_TOKEN',
};

const PROCESSING_CONFIG = {
  MAX_THREADS_PER_HANDLER: 10,
};

const SUBMISSION_HANDLERS = [
  {
    id: 'uenoQuestScore',
    subjectPrefix: 'UENO QUEST SCORE ',
    payloadType: 'ueno-quest-score',
    normalizePayload: normalizeMudScore_,
    createPullRequest: createMudScorePullRequest_,
  },
  {
    id: 'guestbookEntry',
    subjectPrefix: 'GUESTBOOK ENTRY ',
    payloadType: 'guestbook-entry',
    normalizePayload: normalizeGuestbookEntry_,
    createPullRequest: createGuestbookPullRequest_,
  },
  {
    id: 'tokyoRecommendation',
    subjectPrefix: 'TOKYO RECOMMENDATION ',
    payloadType: 'tokyo-recommendation',
    normalizePayload: normalizeTokyoRecommendation_,
    createPullRequest: createTokyoRecommendationPullRequest_,
  },
];

function processApprovedSiteSubmissions() {
  SUBMISSION_HANDLERS.forEach(processApprovedSubmissionsForHandler_);
}

// Kept as a convenience trigger target while this script only handles MUD scores.
function processApprovedMudScores() {
  processApprovedSubmissionsForHandler_(getSubmissionHandler_('uenoQuestScore'));
}

function processGuestbookEntries() {
  processApprovedSubmissionsForHandler_(getSubmissionHandler_('guestbookEntry'));
}

function processTokyoRecommendations() {
  processApprovedSubmissionsForHandler_(getSubmissionHandler_('tokyoRecommendation'));
}

function processApprovedSubmissionsForHandler_(handler) {
  const processedLabel = getOrCreateLabel_(LABEL_CONFIG.PROCESSED);
  const errorLabel = getOrCreateLabel_(LABEL_CONFIG.ERROR);
  const threads = findApprovedThreadsForHandler_(handler);

  threads.forEach((thread) => {
    try {
      const message = getLatestMessage_(thread);
      const payload = extractJsonPayloadFromMessage_(message);
      const submission = normalizeSubmission_(handler, payload, message);
      const result = handler.createPullRequest(submission);
      console.log(`Processed ${handler.id}/${submission.id}: ${result.status}`);
      thread.addLabel(processedLabel);
      thread.markRead();
    } catch (error) {
      console.error(error && error.stack ? error.stack : error);
      thread.addLabel(errorLabel);
    }
  });
}

function findApprovedThreadsForHandler_(handler) {
  const query = [
    `subject:"${handler.subjectPrefix}"`,
    `-label:${LABEL_CONFIG.PROCESSED}`,
  ].join(' ');
  return GmailApp.search(query, 0, PROCESSING_CONFIG.MAX_THREADS_PER_HANDLER);
}

function getLatestMessage_(thread) {
  return thread.getMessages().slice(-1)[0];
}

function normalizeSubmission_(handler, payload, message) {
  if (!payload || payload.type !== handler.payloadType) {
    throw new Error(`Payload is not ${handler.payloadType}.`);
  }

  const submission = handler.normalizePayload(payload);
  const subject = message.getSubject() || '';
  if (!subject.startsWith(handler.subjectPrefix)) {
    throw new Error(`Unexpected subject for ${handler.id}: ${subject}`);
  }
  if (!subject.includes(submission.id)) {
    throw new Error(`Subject does not include submission ID ${submission.id}.`);
  }
  return submission;
}

function extractJsonPayloadFromMessage_(message) {
  const body = message.getPlainBody() || '';
  const firstBrace = body.indexOf('{');
  const lastBrace = body.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No JSON payload found in email body.');
  }
  return JSON.parse(body.slice(firstBrace, lastBrace + 1));
}

function getSubmissionHandler_(handlerId) {
  const handler = SUBMISSION_HANDLERS.find((candidate) => candidate.id === handlerId);
  if (!handler) {
    throw new Error(`Unknown submission handler: ${handlerId}`);
  }
  return handler;
}

function normalizeMudScore_(payload) {
  const id = cleanId_(payload.id);
  const name = cleanName_(payload.name);
  const moves = Number(payload.moves);
  const sideQuests = cleanTextArray_(payload.sideQuests || [], 40, 12);
  const sideQuestCount = Math.max(sideQuests.length, Number(payload.sideQuestCount) || 0);
  const completedAt = String(payload.completedAt || '');
  const completedTime = new Date(completedAt).getTime();

  if (!id) {
    throw new Error('Missing or invalid score ID.');
  }
  if (!Number.isInteger(moves) || moves < 1 || moves > 999) {
    throw new Error(`Invalid move count: ${payload.moves}`);
  }
  if (!Number.isFinite(completedTime)) {
    throw new Error(`Invalid completion timestamp: ${completedAt}`);
  }

  return {
    id,
    name,
    moves,
    sideQuests,
    sideQuestCount,
    rank: cleanText_(payload.rank || mudRankForSubmission_(moves, sideQuestCount), 40),
    route: cleanText_(payload.route || 'Ueno -> Otemachi -> Shibuya -> Ueno', 80),
    completedAt: new Date(completedTime).toISOString(),
    approvedAt: new Date().toISOString(),
    source: 'gmail',
  };
}

function createMudScorePullRequest_(score) {
  return appendEntryToJsonFilePullRequest_({
    path: 'data/mud-leaderboard.json',
    entry: score,
    getEntries: (document) => Array.isArray(document.entries) ? document.entries : [],
    setEntries: (document, entries) => ({ ...document, entries }),
    isDuplicate: (entry) => entry.id === score.id,
    sortEntries: (entries) => entries.sort((a, b) => (
      Number(a.moves) - Number(b.moves)
      || getSideQuestCount_(b) - getSideQuestCount_(a)
      || String(a.completedAt).localeCompare(String(b.completedAt))
    )),
    branchPrefix: 'mud-score',
    commitMessage: `Add Ueno Quest score for ${score.name}`,
    pullRequestTitle: `Add Ueno Quest score for ${score.name}`,
    pullRequestBody: [
      'Adds an approved Ueno Quest leaderboard score from Gmail.',
      '',
      `- Name: ${score.name}`,
      `- Moves: ${score.moves}`,
      `- Side quests: ${score.sideQuestCount}`,
      score.sideQuests.length ? `- Side quest names: ${score.sideQuests.join(', ')}` : '- Side quest names: none',
      `- Rank: ${score.rank}`,
      `- Score ID: ${score.id}`,
    ].join('\n'),
  });
}

function normalizeGuestbookEntry_(payload) {
  const id = cleanId_(payload.id);
  const name = cleanName_(payload.name);
  const countryCode = cleanCountryCode_(payload.countryCode);
  const countryName = cleanText_(payload.countryName || countryCode, 60);
  const comment = cleanText_(payload.comment || '', 120);
  const signedAt = String(payload.signedAt || '');
  const signedTime = new Date(signedAt).getTime();

  if (!id) {
    throw new Error('Missing or invalid guestbook ID.');
  }
  if (!countryCode) {
    throw new Error(`Invalid country code: ${payload.countryCode}`);
  }
  if (!Number.isFinite(signedTime)) {
    throw new Error(`Invalid signed timestamp: ${signedAt}`);
  }

  return {
    id,
    name,
    countryCode,
    countryName,
    comment,
    signedAt: new Date(signedTime).toISOString(),
    approvedAt: new Date().toISOString(),
    source: 'gmail',
  };
}

function createGuestbookPullRequest_(entry) {
  return appendEntryToJsonFilePullRequest_({
    path: 'data/guestbook.json',
    entry,
    getEntries: (document) => Array.isArray(document.entries) ? document.entries : [],
    setEntries: (document, entries) => ({ ...document, entries }),
    isDuplicate: (candidate) => candidate.id === entry.id,
    sortEntries: (entries) => entries.sort((a, b) => String(b.signedAt).localeCompare(String(a.signedAt))),
    branchPrefix: 'guestbook',
    commitMessage: `Add guestbook entry for ${entry.name}`,
    pullRequestTitle: `Add guestbook entry for ${entry.name}`,
    pullRequestBody: [
      'Adds a guestbook entry submitted from the site.',
      '',
      `- Name: ${entry.name}`,
      `- Country: ${entry.countryName} (${entry.countryCode})`,
      entry.comment ? `- Comment: ${entry.comment}` : '- Comment: none',
      `- Entry ID: ${entry.id}`,
    ].join('\n'),
  });
}

function normalizeTokyoRecommendation_(payload) {
  const id = cleanId_(payload.id);
  const name = cleanName_(payload.name);
  const recommendation = cleanText_(payload.recommendation, 80);
  const comment = cleanText_(payload.comment || '', 140);
  const submittedAt = String(payload.submittedAt || '');
  const submittedTime = new Date(submittedAt).getTime();

  if (!id) {
    throw new Error('Missing or invalid Tokyo recommendation ID.');
  }
  if (!recommendation) {
    throw new Error('Missing Tokyo recommendation.');
  }
  if (!Number.isFinite(submittedTime)) {
    throw new Error(`Invalid submitted timestamp: ${submittedAt}`);
  }

  return {
    id,
    name,
    recommendation,
    comment,
    submittedAt: new Date(submittedTime).toISOString(),
    approvedAt: new Date().toISOString(),
    source: 'gmail',
  };
}

function createTokyoRecommendationPullRequest_(entry) {
  return appendEntryToJsonFilePullRequest_({
    path: 'data/tokyo-recommendations.json',
    entry,
    getEntries: (document) => Array.isArray(document.entries) ? document.entries : [],
    setEntries: (document, entries) => ({ ...document, entries }),
    isDuplicate: (candidate) => candidate.id === entry.id,
    sortEntries: (entries) => entries.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt))),
    branchPrefix: 'tokyo-rec',
    commitMessage: `Add Tokyo recommendation for ${entry.recommendation}`,
    pullRequestTitle: `Add Tokyo recommendation: ${entry.recommendation}`,
    pullRequestBody: [
      'Adds a Tokyo recommendation submitted from the site.',
      '',
      `- Recommendation: ${entry.recommendation}`,
      `- Name: ${entry.name}`,
      entry.comment ? `- Comment: ${entry.comment}` : '- Comment: none',
      `- Entry ID: ${entry.id}`,
    ].join('\n'),
  });
}

function appendEntryToJsonFilePullRequest_(options) {
  const baseRef = getBaseBranchRef_();
  const file = getRepoFile_(options.path);
  const document = JSON.parse(decodeBase64_(file.content));
  const entries = options.getEntries(document);

  if (entries.some(options.isDuplicate)) {
    return { status: 'duplicate' };
  }

  entries.push(options.entry);
  const nextEntries = options.sortEntries ? options.sortEntries(entries) : entries;
  const nextDocument = options.setEntries(document, nextEntries);
  const nextContent = `${JSON.stringify(nextDocument, null, 2)}\n`;
  const branchName = createBranchName_(options.branchPrefix, options.entry.id);

  createBranch_(branchName, baseRef.object.sha);
  updateRepoFile_(options.path, {
    message: options.commitMessage,
    content: nextContent,
    sha: file.sha,
    branch: branchName,
  });

  const pull = createPullRequest_({
    title: options.pullRequestTitle,
    head: branchName,
    body: options.pullRequestBody,
  });

  return {
    status: 'created',
    url: pull.html_url,
  };
}

function getBaseBranchRef_() {
  return githubRequest_('get', `/git/ref/heads/${GITHUB_CONFIG.BASE_BRANCH}`);
}

function getRepoFile_(path) {
  return githubRequest_(
    'get',
    `/contents/${encodeRepoPath_(path)}?ref=${encodeURIComponent(GITHUB_CONFIG.BASE_BRANCH)}`
  );
}

function createBranch_(branchName, sha) {
  return githubRequest_('post', '/git/refs', {
    ref: `refs/heads/${branchName}`,
    sha,
  });
}

function updateRepoFile_(path, options) {
  return githubRequest_('put', `/contents/${encodeRepoPath_(path)}`, {
    message: options.message,
    content: encodeBase64_(options.content),
    sha: options.sha,
    branch: options.branch,
  });
}

function createPullRequest_(options) {
  return githubRequest_('post', '/pulls', {
    title: options.title,
    head: options.head,
    base: GITHUB_CONFIG.BASE_BRANCH,
    body: options.body,
  });
}

function createBranchName_(prefix, id) {
  return `${prefix}-${id}`.toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 90);
}

function githubRequest_(method, path, payload) {
  const token = PropertiesService.getScriptProperties().getProperty(GITHUB_CONFIG.TOKEN_PROPERTY);
  if (!token) {
    throw new Error(`Missing Script Property ${GITHUB_CONFIG.TOKEN_PROPERTY}.`);
  }

  const options = {
    method,
    muteHttpExceptions: true,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };

  if (payload !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  const url = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}${path}`;
  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(`GitHub ${method.toUpperCase()} ${path} failed: ${status} ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function cleanId_(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{5,80}$/.test(id) ? id : '';
}

function cleanName_(value) {
  return cleanText_(value || 'Anonymous', 18) || 'Anonymous';
}

function cleanCountryCode_(value) {
  const countryCode = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(countryCode) ? countryCode : '';
}

function cleanTextArray_(value, itemMaxLength, maxItems) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => cleanText_(item, itemMaxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function getSideQuestCount_(entry) {
  if (Array.isArray(entry && entry.sideQuests)) {
    return entry.sideQuests.length;
  }
  return Number(entry && entry.sideQuestCount) || 0;
}

function mudRankForSubmission_(moves, sideQuestCount) {
  if (moves <= 14) {
    return 'Senior Soba Engineer';
  }
  if (sideQuestCount >= 4) {
    return 'Tokyo Completionist';
  }
  return 'Soba Engineer';
}

function cleanText_(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function encodeRepoPath_(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function decodeBase64_(value) {
  const cleaned = String(value || '').replace(/\s/g, '');
  return Utilities.newBlob(Utilities.base64Decode(cleaned)).getDataAsString();
}

function encodeBase64_(value) {
  return Utilities.base64Encode(Utilities.newBlob(value).getBytes());
}
