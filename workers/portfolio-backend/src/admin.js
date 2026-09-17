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
  <p id="status">Loading…</p>
  <main id="queue"></main>
  <script>
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
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(entry, null, 2);
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

async function fetchQueue(db) {
  const [guestbook, tokyo, mud, contacts, productClicks] = await Promise.all([
    db.prepare(`
      SELECT id, name, country_code AS countryCode, country_name AS countryName,
             comment, signed_at AS signedAt, submitted_at AS submittedAt
      FROM guestbook_entries WHERE status = 'pending'
      ORDER BY submitted_at ASC
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
    tokyo: tokyo.results || [],
    mud: (mud.results || []).map((entry) => ({
      ...entry,
      sideQuests: JSON.parse(entry.sideQuests || '[]'),
    })),
    contacts: contacts.results || [],
    productClicks: productClicks.results || [],
  };
}

const CONTENT_TABLES = {
  guestbook: 'guestbook_entries',
  tokyo: 'tokyo_recommendations',
  mud: 'mud_scores',
};

export async function handleAdminRequest(request, env, identity) {
  const url = new URL(request.url);
  if (request.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/')) {
    return new Response(adminPage(identity.email || 'Cloudflare Access user'), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; connect-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  if (request.method === 'GET' && url.pathname === '/admin/api/queue') {
    return json(await fetchQueue(env.DB));
  }
  if (request.method === 'POST') {
    const match = url.pathname.match(/^\/admin\/api\/(guestbook|tokyo|mud|contact)\/([^/]+)\/(approve|reject|read|archive)$/);
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
