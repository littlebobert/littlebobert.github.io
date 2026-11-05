// Events for the in-person guestbook. One runs at a time; signatures made while it runs are
// attached to it on the server, so the signing page never says which event it's for.
export const EVENT_HOURS = 12;

export async function currentEvent(db, now = new Date().toISOString()) {
  return db.prepare(`
    SELECT id, name, started_at AS startedAt, ends_at AS endsAt
    FROM events
    WHERE started_at <= ? AND ends_at > ?
    ORDER BY started_at DESC
    LIMIT 1
  `).bind(now, now).first();
}

export async function startEvent(db, name, now = new Date()) {
  const startedAt = now.toISOString();
  await endEvents(db, startedAt);
  const event = {
    id: crypto.randomUUID(),
    name,
    startedAt,
    endsAt: new Date(now.getTime() + EVENT_HOURS * 60 * 60 * 1000).toISOString(),
  };
  await db.prepare(`
    INSERT INTO events (id, name, started_at, ends_at) VALUES (?, ?, ?, ?)
  `).bind(event.id, event.name, event.startedAt, event.endsAt).run();
  return event;
}

// Ends every running event, or just one, now.
export async function endEvents(db, now = new Date().toISOString(), id = null) {
  return db.prepare(`
    UPDATE events SET ends_at = ? WHERE ends_at > ? AND (? IS NULL OR id = ?)
  `).bind(now, now, id, id).run();
}
