import { currentEvent, endEvents, EVENT_HOURS, startEvent } from './events.js';
import { SIGN_QR_SVG, SIGN_URL } from './sign-qr.js';
import { validateEventName } from './validation.js';

// Draws signature ink into an <svg>, all at once or replayed at the pace it was signed (pauses
// between strokes shortened, the whole thing squeezed into a few seconds). Inlined in both admin
// pages; the site has the same function in signature-ink.js.
const INK_SCRIPT = `
function drawInk(svg, ink, options) {
  const animate = options && options.animate;
  const NS = 'http://www.w3.org/2000/svg';
  svg.setAttribute('viewBox', '0 0 ' + ink.width + ' ' + ink.height);
  svg.textContent = '';
  let clock = 0;
  const strokes = ink.strokes.map((flat) => {
    const points = [];
    for (let i = 0; i < flat.length; i += 3) points.push([flat[i], flat[i + 1], flat[i + 2]]);
    const first = points[0][2];
    const timed = points.map(([x, y, t]) => [x, y, clock + t - first]);
    clock = timed[timed.length - 1][2] + 150;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '3.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
    return { points: timed, path };
  });
  const pathData = (points) => points.length === 1
    ? 'M' + points[0][0] + ' ' + points[0][1] + 'h0'
    : 'M' + points.map((p) => p[0] + ' ' + p[1]).join('L');
  const drawUntil = (time) => strokes.forEach(({ points, path }) => {
    const shown = points.filter((p) => p[2] <= time);
    path.setAttribute('d', shown.length ? pathData(shown) : '');
  });
  if (!animate) { drawUntil(Infinity); return () => {}; }
  const scale = Math.min(1, 4000 / Math.max(clock, 1));
  const start = performance.now();
  let frame = 0;
  const step = (now) => {
    const time = (now - start) / scale;
    drawUntil(time);
    if (time < clock) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}
`;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function adminPage(email) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Portfolio moderation</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    body { margin: 0 auto; max-width: 1000px; padding: 24px; }
    header { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
    section { border: 1px solid currentColor; margin: 20px 0; padding: 16px; }
    article { border-top: 1px dotted currentColor; padding: 14px 0; }
    article:first-of-type { border-top: 0; }
    pre { overflow-wrap: anywhere; white-space: pre-wrap; }
    button { font: inherit; margin: 4px 8px 4px 0; padding: 6px 10px; }
    .empty { opacity: .7; }
    .ink { display: block; width: 100%; max-width: 400px; aspect-ratio: 2; border: 1px solid currentColor; }
    .error { color: #b42318; }
    .analytics-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
    .analytics-metric { border: 1px solid currentColor; padding: 12px; }
    .analytics-metric strong { display: block; font-size: 1.6rem; margin-top: 6px; }
    .analytics-table-wrap { overflow-x: auto; }
    .analytics-table { border-collapse: collapse; width: 100%; }
    .analytics-table th, .analytics-table td { border-top: 1px dotted currentColor; padding: 12px 10px; text-align: left; vertical-align: top; }
    .analytics-table th { opacity: .72; white-space: nowrap; }
    .analytics-table td:nth-child(3), .analytics-table th:nth-child(3) { text-align: right; }
    .analytics-table tbody tr:last-child td { border-bottom: 1px dotted currentColor; }
    .analytics-product { font-weight: bold; text-transform: capitalize; }
    .analytics-action { opacity: .72; }
    .analytics-clicks { font-size: 1.35rem; font-weight: bold; }
    .analytics-date { white-space: nowrap; }
    @media (max-width: 700px) {
      .analytics-summary { grid-template-columns: 1fr; }
      .analytics-table th, .analytics-table td { padding: 10px 8px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Portfolio moderation</h1>
    <small>${escapeHtml(email)}</small>
  </header>
  <p><a href="/admin/live">Live page for events</a></p>
  <p id="status">Loading…</p>
  <main id="queue"></main>
  <script>${INK_SCRIPT}
    const queue = document.getElementById('queue');
    const status = document.getElementById('status');

    function renderSection(title, kind, entries, contact = false) {
      const section = document.createElement('section');
      const heading = document.createElement('h2');
      heading.textContent = title + ' (' + entries.length + ')';
      section.append(heading);
      if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = 'Nothing here.';
        section.append(empty);
        return section;
      }
      entries.forEach((entry) => {
        const article = document.createElement('article');
        if (entry.ink) {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('class', 'ink');
          drawInk(svg, entry.ink);
          article.append(svg);
        }
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(entry.ink ? { ...entry, ink: undefined } : entry, null, 2);
        article.append(pre);
        const actions = contact
          ? entry.status === 'unread'
            ? [['read', 'Mark read'], ['archive', 'Archive']]
            : [['archive', 'Archive']]
          : [['approve', 'Approve'], ['reject', 'Reject']];
        actions.forEach(([action, label]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = label;
          button.addEventListener('click', async () => {
            button.disabled = true;
            const response = await fetch('/admin/api/' + kind + '/' + encodeURIComponent(entry.id) + '/' + action, {
              method: 'POST',
            });
            if (!response.ok) {
              status.className = 'error';
              status.textContent = 'Action failed: ' + response.status;
              button.disabled = false;
              return;
            }
            await loadQueue();
          });
          article.append(button);
        });
        section.append(article);
      });
      return section;
    }

    function formatAnalyticsDate(value) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return '—';
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    }

    function analyticsMetric(label, value) {
      const metric = document.createElement('div');
      metric.className = 'analytics-metric';
      const labelElement = document.createElement('span');
      labelElement.textContent = label;
      const valueElement = document.createElement('strong');
      valueElement.textContent = value;
      metric.append(labelElement, valueElement);
      return metric;
    }

    function renderProductClickAnalytics(entries) {
      const section = document.createElement('section');
      const heading = document.createElement('h2');
      heading.textContent = 'Product download clicks';
      section.append(heading);

      if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = 'No download clicks yet.';
        section.append(empty);
        return section;
      }

      const totalClicks = entries.reduce((total, entry) => total + Number(entry.clicks || 0), 0);
      const activeProducts = new Set(entries.map((entry) => entry.product)).size;
      const latestClick = entries.reduce((latest, entry) => {
        const timestamp = Date.parse(entry.lastClickedAt);
        return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest;
      }, 0);
      const summary = document.createElement('div');
      summary.className = 'analytics-summary';
      summary.append(
        analyticsMetric('Total clicks', totalClicks.toLocaleString()),
        analyticsMetric('Active products', activeProducts.toLocaleString()),
        analyticsMetric('Latest click', latestClick ? formatAnalyticsDate(latestClick) : '—'),
      );
      section.append(summary);

      const actionLabels = {
        'download-macos': 'Download for macOS',
        'join-testflight': 'Join TestFlight',
      };
      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'analytics-table-wrap';
      const table = document.createElement('table');
      table.className = 'analytics-table';
      const tableHead = document.createElement('thead');
      const headingRow = document.createElement('tr');
      ['Product', 'Destination', 'Clicks', 'First click', 'Last click'].forEach((label) => {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.textContent = label;
        headingRow.append(cell);
      });
      tableHead.append(headingRow);
      const tableBody = document.createElement('tbody');
      entries.forEach((entry) => {
        const row = document.createElement('tr');
        const productCell = document.createElement('td');
        productCell.className = 'analytics-product';
        productCell.textContent = entry.product;
        const actionCell = document.createElement('td');
        actionCell.className = 'analytics-action';
        actionCell.textContent = actionLabels[entry.action] || entry.action;
        const clicksCell = document.createElement('td');
        clicksCell.className = 'analytics-clicks';
        clicksCell.textContent = Number(entry.clicks || 0).toLocaleString();
        const firstClickCell = document.createElement('td');
        firstClickCell.className = 'analytics-date';
        firstClickCell.textContent = formatAnalyticsDate(entry.firstClickedAt);
        firstClickCell.title = entry.firstClickedAt || '';
        const lastClickCell = document.createElement('td');
        lastClickCell.className = 'analytics-date';
        lastClickCell.textContent = formatAnalyticsDate(entry.lastClickedAt);
        lastClickCell.title = entry.lastClickedAt || '';
        row.append(productCell, actionCell, clicksCell, firstClickCell, lastClickCell);
        tableBody.append(row);
      });
      table.append(tableHead, tableBody);
      tableWrapper.append(table);
      section.append(tableWrapper);
      return section;
    }

    async function loadQueue() {
      status.className = '';
      status.textContent = 'Loading…';
      const response = await fetch('/admin/api/queue', { cache: 'no-store' });
      if (!response.ok) {
        status.className = 'error';
        status.textContent = 'Could not load queue: ' + response.status;
        return;
      }
      const data = await response.json();
      queue.textContent = '';
      queue.append(
        renderSection('Guestbook', 'guestbook', data.guestbook),
        renderSection('In-person signatures', 'signature', data.signatures),
        renderSection('Tokyo recommendations', 'tokyo', data.tokyo),
        renderSection('MUD scores', 'mud', data.mud),
        renderSection('Contact inbox', 'contact', data.contacts, true),
        renderProductClickAnalytics(data.productClicks),
      );
      status.textContent = 'Updated ' + new Date().toLocaleString();
    }

    loadQueue();
  </script>
</body>
</html>`;
}

// The page on Justin's phone at an event: the QR code to show people, the event, and each new
// signature, which takes over the screen and redraws itself so the signer sees it arrive.
function livePage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#ffffff">
  <title>Guestbook live</title>
  <style>
    * { box-sizing: border-box; }
    html { background: #fff; color: #000; }
    body { margin: 0 auto; max-width: 560px; padding: 16px 16px 48px; font: 15px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; }
    a { color: inherit; }
    .window { border: 2px solid #000; box-shadow: 3px 3px 0 #000; background: #fff; margin: 0 0 18px; }
    .title { border-bottom: 2px solid #000; padding: 3px 8px; text-align: center; font-weight: bold;
      background: repeating-linear-gradient(#fff 0 2px, #000 2px 3px) ; }
    .title span { background: #fff; padding: 0 8px; }
    .body { padding: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .muted { opacity: .7; }
    form { display: flex; gap: 8px; }
    input { flex: 1; min-width: 0; font: inherit; padding: 8px; border: 2px solid #000; border-radius: 0; }
    button { font: inherit; padding: 7px 12px; border: 2px solid #000; border-radius: 8px; background: #fff; color: #000; }
    button:active { background: #000; color: #fff; }
    .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .qr { display: block; width: min(78vw, 340px); margin: 4px auto 8px; }
    .qr svg { display: block; width: 100%; height: auto; }
    .caption { text-align: center; margin: 0; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
    .card { border: 1px solid #000; padding: 6px; }
    .card svg, .spotlight svg { display: block; width: 100%; aspect-ratio: 2; }
    .card .who { font-size: 13px; margin-top: 4px; overflow-wrap: anywhere; }
    .card .actions { display: flex; gap: 6px; margin-top: 6px; }
    .card .actions button { flex: 1; padding: 4px; font-size: 13px; }
    .card.approved { border-width: 2px; }
    .chip { font-size: 12px; }
    .spotlight { position: fixed; inset: 0; background: #fff; display: flex; flex-direction: column;
      justify-content: center; align-items: center; padding: 24px; gap: 16px; text-align: center; z-index: 2; }
    .spotlight[hidden] { display: none; }
    .spotlight .frame { width: 100%; max-width: 640px; border: 2px solid #000; box-shadow: 4px 4px 0 #000; padding: 12px; }
    .spotlight .thanks { font-size: 26px; font-weight: bold; }
    .spotlight .note { font-size: 18px; }
    .error { color: #b42318; }
  </style>
</head>
<body>
  <div class="window">
    <div class="title"><span>Guestbook live</span></div>
    <div class="body" id="event">Loading…</div>
  </div>
  <div class="window">
    <div class="title"><span>Sign my guestbook</span></div>
    <div class="body">
      <div class="qr">${SIGN_QR_SVG}</div>
      <p class="caption">${escapeHtml(SIGN_URL.replace('https://', ''))}</p>
      <p class="caption muted">読み取って、指でサインしてください</p>
    </div>
  </div>
  <div class="window">
    <div class="title"><span id="count">Signatures</span></div>
    <div class="body"><div class="cards" id="cards"></div><p id="empty" class="muted" hidden>No signatures yet.</p></div>
  </div>
  <p><a href="/admin">Moderation queue</a> · <span id="status" class="muted"></span></p>
  <div class="spotlight" id="spotlight" hidden>
    <div class="thanks" id="spotlight-thanks"></div>
    <div class="frame"><svg id="spotlight-ink"></svg></div>
    <div class="note" id="spotlight-note"></div>
    <div class="muted">Tap to close</div>
  </div>
  <script>${INK_SCRIPT}
    const eventBox = document.getElementById('event');
    const cards = document.getElementById('cards');
    const empty = document.getElementById('empty');
    const count = document.getElementById('count');
    const status = document.getElementById('status');
    const spotlight = document.getElementById('spotlight');
    let seen = null;
    let queue = [];
    let showing = false;
    let hideTimer = 0;
    let cancelReplay = () => {};
    let eventId = null;
    let shownKey = '';

    const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    async function post(path, body) {
      const response = await fetch(path, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || response.status);
    }

    function renderEvent(event, total) {
      eventBox.textContent = '';
      if (event) {
        const row = document.createElement('div');
        row.className = 'row';
        const info = document.createElement('div');
        const name = document.createElement('h1');
        name.textContent = event.name;
        const until = document.createElement('div');
        until.className = 'muted';
        until.textContent = 'Until ' + time(event.endsAt) + ' · ' + total + (total === 1 ? ' signature' : ' signatures');
        info.append(name, until);
        const end = document.createElement('button');
        end.textContent = 'End';
        end.addEventListener('click', async () => {
          if (!confirm('End ' + event.name + '? New signatures won’t belong to it.')) return;
          await post('/admin/api/events/' + encodeURIComponent(event.id) + '/end').catch(showError);
          load();
        });
        row.append(info, end);
        eventBox.append(row);
        return;
      }
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.placeholder = 'Event name';
      input.maxLength = 60;
      input.required = true;
      const start = document.createElement('button');
      start.textContent = 'Start';
      form.append(input, start);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        start.disabled = true;
        await post('/admin/api/events', { name: input.value }).catch(showError);
        load();
      });
      const hint = document.createElement('p');
      hint.className = 'muted';
      hint.textContent = 'No event running. Signatures still arrive, just without an event. An event runs ${EVENT_HOURS} hours unless you end it.';
      eventBox.append(form, hint);
    }

    function card(signature) {
      const element = document.createElement('div');
      element.className = 'card ' + signature.status;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      drawInk(svg, signature.ink);
      const who = document.createElement('div');
      who.className = 'who';
      who.textContent = [signature.name, signature.note].filter(Boolean).join(' — ') || '(no name)';
      const meta = document.createElement('div');
      meta.className = 'chip muted';
      meta.textContent = time(signature.submittedAt) + ' · ' + signature.status;
      element.append(svg, who, meta);
      if (signature.status === 'pending') {
        const actions = document.createElement('div');
        actions.className = 'actions';
        [['approve', 'Approve'], ['reject', 'Reject']].forEach(([action, label]) => {
          const button = document.createElement('button');
          button.textContent = label;
          button.addEventListener('click', async () => {
            button.disabled = true;
            await post('/admin/api/signature/' + encodeURIComponent(signature.id) + '/' + action).catch(showError);
            load();
          });
          actions.append(button);
        });
        element.append(actions);
      }
      element.addEventListener('click', (e) => { if (!e.target.closest('button')) spotlightOn(signature); });
      return element;
    }

    function spotlightOn(signature) {
      clearTimeout(hideTimer);
      cancelReplay();
      showing = true;
      document.getElementById('spotlight-thanks').textContent = signature.name
        ? 'Thanks, ' + signature.name + '!' : 'Thank you!';
      document.getElementById('spotlight-note').textContent = signature.note || '';
      spotlight.hidden = false;
      cancelReplay = drawInk(document.getElementById('spotlight-ink'), signature.ink, { animate: true });
      hideTimer = setTimeout(spotlightOff, 9000);
    }

    function spotlightOff() {
      clearTimeout(hideTimer);
      cancelReplay();
      spotlight.hidden = true;
      showing = false;
      if (queue.length) spotlightOn(queue.shift());
    }
    spotlight.addEventListener('click', spotlightOff);

    function showError(error) {
      status.className = 'error';
      status.textContent = 'Error: ' + error.message;
    }

    async function load() {
      try {
        const response = await fetch('/admin/api/live', { cache: 'no-store' });
        if (!response.ok) throw new Error('could not load (' + response.status + ')');
        const data = await response.json();
        if ((data.event && data.event.id) !== eventId) seen = null;
        eventId = data.event && data.event.id;
        // Rebuild only when something changed, so a tap never lands on a button being replaced.
        const key = JSON.stringify([data.event, data.signatures.map((s) => [s.id, s.status])]);
        if (key !== shownKey) {
          shownKey = key;
          renderEvent(data.event, data.signatures.length);
          cards.replaceChildren(...data.signatures.map(card));
          empty.hidden = data.signatures.length > 0;
          count.textContent = data.event ? 'Signatures' : 'Recent signatures';
        }
        // Anything new since the last load takes over the screen, oldest first.
        if (seen) {
          const fresh = data.signatures.filter((s) => !seen.has(s.id)).reverse();
          queue.push(...fresh);
          if (!showing && queue.length) spotlightOn(queue.shift());
        }
        seen = new Set(data.signatures.map((s) => s.id));
        status.className = 'muted';
        status.textContent = 'Updated ' + new Date().toLocaleTimeString();
      } catch (error) {
        showError(error);
      }
    }

    // Keep the screen on while this page is up.
    async function keepAwake() {
      try { if (navigator.wakeLock && !document.hidden) await navigator.wakeLock.request('screen'); } catch {}
    }
    document.addEventListener('visibilitychange', () => { keepAwake(); if (!document.hidden) load(); });
    keepAwake();
    load();
    setInterval(() => { if (!document.hidden) load(); }, 3000);
  </script>
</body>
</html>`;
}

async function liveData(db) {
  const event = await currentEvent(db);
  const result = event
    ? await db.prepare(`
        SELECT id, name, note, ink, status, submitted_at AS submittedAt
        FROM signatures
        WHERE event_id = ? AND status != 'rejected'
        ORDER BY submitted_at DESC
        LIMIT 200
      `).bind(event.id).all()
    : await db.prepare(`
        SELECT id, name, note, ink, status, submitted_at AS submittedAt
        FROM signatures
        WHERE status != 'rejected'
        ORDER BY submitted_at DESC
        LIMIT 30
      `).all();
  return { event, signatures: parseInk(result.results) };
}

const ADMIN_PAGE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; connect-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

async function fetchQueue(db) {
  const [guestbook, signatures, tokyo, mud, contacts, productClicks] = await Promise.all([
    db.prepare(`
      SELECT id, name, country_code AS countryCode, country_name AS countryName,
             comment, signed_at AS signedAt, submitted_at AS submittedAt
      FROM guestbook_entries WHERE status = 'pending'
      ORDER BY submitted_at ASC
    `).all(),
    db.prepare(`
      SELECT signatures.id, signatures.name, signatures.note, signatures.ink,
             signatures.submitted_at AS submittedAt, events.name AS eventName
      FROM signatures
      LEFT JOIN events ON events.id = signatures.event_id
      WHERE signatures.status = 'pending'
      ORDER BY signatures.submitted_at ASC
    `).all(),
    db.prepare(`
      SELECT id, name, recommendation, comment, submitted_at AS submittedAt
      FROM tokyo_recommendations WHERE status = 'pending'
      ORDER BY submitted_at ASC
    `).all(),
    db.prepare(`
      SELECT id, name, moves, side_quests AS sideQuests, side_quest_count AS sideQuestCount,
             rank, route, completed_at AS completedAt, submitted_at AS submittedAt
      FROM mud_scores WHERE status = 'pending'
      ORDER BY submitted_at ASC
    `).all(),
    db.prepare(`
      SELECT id, category, name, email, message, status, submitted_at AS submittedAt
      FROM contact_messages WHERE status IN ('unread', 'read')
      ORDER BY submitted_at DESC
    `).all(),
    db.prepare(`
      SELECT product, action, clicks, first_clicked_at AS firstClickedAt,
             last_clicked_at AS lastClickedAt
      FROM product_clicks
      ORDER BY clicks DESC, product ASC, action ASC
    `).all(),
  ]);
  return {
    guestbook: guestbook.results || [],
    signatures: parseInk(signatures.results),
    tokyo: tokyo.results || [],
    mud: (mud.results || []).map((entry) => ({
      ...entry,
      sideQuests: JSON.parse(entry.sideQuests || '[]'),
    })),
    contacts: contacts.results || [],
    productClicks: productClicks.results || [],
  };
}

function parseInk(rows) {
  return (rows || []).map((row) => ({ ...row, ink: JSON.parse(row.ink) }));
}

const CONTENT_TABLES = {
  guestbook: 'guestbook_entries',
  signature: 'signatures',
  tokyo: 'tokyo_recommendations',
  mud: 'mud_scores',
};

export async function handleAdminRequest(request, env, identity) {
  const url = new URL(request.url);
  if (request.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/')) {
    return new Response(adminPage(identity.email || 'Cloudflare Access user'), {
      headers: ADMIN_PAGE_HEADERS,
    });
  }
  if (request.method === 'GET' && url.pathname === '/admin/live') {
    return new Response(livePage(), { headers: ADMIN_PAGE_HEADERS });
  }
  if (request.method === 'GET' && url.pathname === '/admin/api/live') {
    return json(await liveData(env.DB));
  }
  // JSON only, so a plain cross-site form can't start an event.
  if (request.method === 'POST' && url.pathname === '/admin/api/events') {
    if (!String(request.headers.get('Content-Type') || '').startsWith('application/json')) {
      return json({ error: 'Expected JSON.' }, 415);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Expected JSON.' }, 400);
    }
    let name;
    try {
      name = validateEventName(body);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
    return json({ event: await startEvent(env.DB, name) }, 201);
  }
  const endMatch = url.pathname.match(/^\/admin\/api\/events\/([^/]+)\/end$/);
  if (request.method === 'POST' && endMatch) {
    const result = await endEvents(env.DB, new Date().toISOString(), decodeURIComponent(endMatch[1]));
    if (!result.meta?.changes) return json({ error: 'That event isn’t running.' }, 404);
    return json({ success: true });
  }
  if (request.method === 'GET' && url.pathname === '/admin/api/queue') {
    return json(await fetchQueue(env.DB));
  }
  if (request.method === 'POST') {
    const match = url.pathname.match(/^\/admin\/api\/(guestbook|signature|tokyo|mud|contact)\/([^/]+)\/(approve|reject|read|archive)$/);
    if (!match) return json({ error: 'Not found.' }, 404);
    const [, kind, encodedId, action] = match;
    const id = decodeURIComponent(encodedId);
    const now = new Date().toISOString();
    let result;
    if (kind === 'contact') {
      if (!['read', 'archive'].includes(action)) return json({ error: 'Invalid action.' }, 400);
      result = await env.DB.prepare(`
        UPDATE contact_messages
        SET status = ?, reviewed_at = ?
        WHERE id = ? AND status IN ('unread', 'read')
      `).bind(action === 'read' ? 'read' : 'archived', now, id).run();
    } else {
      if (!['approve', 'reject'].includes(action)) return json({ error: 'Invalid action.' }, 400);
      const table = CONTENT_TABLES[kind];
      const status = action === 'approve' ? 'approved' : 'rejected';
      result = await env.DB.prepare(`
        UPDATE ${table}
        SET status = ?, approved_at = ?, reviewed_at = ?
        WHERE id = ? AND status = 'pending'
      `).bind(status, action === 'approve' ? now : null, now, id).run();
    }
    if (!result.meta?.changes) return json({ error: 'Record was not found or already reviewed.' }, 404);
    return json({ success: true });
  }
  return json({ error: 'Not found.' }, 404);
}
