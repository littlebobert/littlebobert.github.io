-- Speak desk accessory (src/speak.js): voice agent calls handed out per Japan-time day, checked
-- against SPEAK_DAILY_CALLS.
CREATE TABLE IF NOT EXISTS speak_calls (
  day TEXT PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0 CHECK (calls >= 0)
);
