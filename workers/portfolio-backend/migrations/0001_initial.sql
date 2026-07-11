CREATE TABLE IF NOT EXISTS guestbook_entries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  signed_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TEXT,
  reviewed_at TEXT,
  source TEXT NOT NULL DEFAULT 'cloudflare'
);

CREATE INDEX IF NOT EXISTS guestbook_status_date
  ON guestbook_entries(status, approved_at DESC, signed_at DESC);

CREATE TABLE IF NOT EXISTS tokyo_recommendations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TEXT,
  reviewed_at TEXT,
  source TEXT NOT NULL DEFAULT 'cloudflare'
);

CREATE INDEX IF NOT EXISTS tokyo_status_date
  ON tokyo_recommendations(status, approved_at DESC, submitted_at DESC);

CREATE TABLE IF NOT EXISTS mud_scores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  moves INTEGER NOT NULL CHECK (moves BETWEEN 1 AND 999),
  side_quests TEXT NOT NULL DEFAULT '[]',
  side_quest_count INTEGER NOT NULL DEFAULT 0,
  rank TEXT NOT NULL,
  route TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TEXT,
  reviewed_at TEXT,
  source TEXT NOT NULL DEFAULT 'cloudflare'
);

CREATE INDEX IF NOT EXISTS mud_status_score
  ON mud_scores(status, moves ASC, side_quest_count DESC, completed_at ASC);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('app-idea', 'tokyo', 'running')),
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS contact_status_date
  ON contact_messages(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS page_views (
  site TEXT NOT NULL,
  path TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (site, path)
);

CREATE TABLE IF NOT EXISTS page_view_visitors (
  visitor_key TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  path TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS page_view_visitor_expiry
  ON page_view_visitors(expires_at);
