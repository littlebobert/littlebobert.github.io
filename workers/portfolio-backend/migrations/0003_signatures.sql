-- In-person guestbook: finger signatures from onemorething.tokyo/sign, attached to the event
-- running when they were signed. Like the other submissions, they're public only once approved.
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ends_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_by_time
  ON events(started_at DESC, ends_at);

CREATE TABLE IF NOT EXISTS signatures (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id),
  name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  -- {"width":400,"height":200,"strokes":[[x,y,t,x,y,t,…],…]}, t in ms from the first touch.
  ink TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TEXT,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS signatures_by_status
  ON signatures(status, approved_at DESC, submitted_at DESC);

CREATE INDEX IF NOT EXISTS signatures_by_event
  ON signatures(event_id, submitted_at DESC);
