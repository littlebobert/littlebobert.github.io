// Karui desk accessory: Karui's App Store listing on the desk, with the current version's release
// notes in one bubble below it. The notes come from the App Store through the portfolio backend
// (/api/v1/karui/latest), in the site's language; the subtitle and promotional text are in
// index.html. Click the bubble to read every note in full.
(() => {
  const widget = document.getElementById('karui-desk');
  if (!widget) return;

  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API = local ? 'http://localhost:8787' : 'https://portfolio-backend.justin-garcia.workers.dev';

  const release = widget.querySelector('.karui-desk-release');
  const notes = widget.querySelector('.karui-desk-notes');
  const language = () => (document.documentElement.lang === 'ja' ? 'ja' : 'en');

  const TEXT = {
    whatsNew: ['What’s New in %@', '%@ の新機能'],
    loading: ['Checking the App Store…', 'App Storeを確認中…'],
    failed: ['The App Store isn’t answering right now.', 'App Storeからいま応答がありません。'],
    released: ['Released %@', '%@リリース'],
    today: ['today', '今日'],
    yesterday: ['yesterday', '昨日'],
  };
  const text = (key, value = '') => TEXT[key][language() === 'ja' ? 1 : 0].replace('%@', value);

  // Days between two moments, counted on Tokyo's calendar.
  const tokyoDay = (date) => {
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date).split('-').map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  };

  function releaseDate(date) {
    const days = tokyoDay(new Date()) - tokyoDay(date);
    if (days <= 0) return text('today');
    if (days === 1) return text('yesterday');
    return new Intl.DateTimeFormat(language() === 'ja' ? 'ja-JP' : 'en-US', {
      timeZone: 'Asia/Tokyo', month: language() === 'ja' ? 'numeric' : 'short', day: 'numeric',
    }).format(date);
  }

  // One speech bubble with a paragraph per note. Each is cut at three lines until the bubble is
  // clicked.
  function bubble(items) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'karui-desk-note';
    card.setAttribute('aria-expanded', 'false');
    card.append(...items.map((note) => {
      const paragraph = document.createElement('span');
      paragraph.className = 'karui-desk-note-body';
      paragraph.textContent = note;
      return paragraph;
    }));
    card.addEventListener('click', () => {
      card.setAttribute('aria-expanded', String(card.getAttribute('aria-expanded') !== 'true'));
    });
    return card;
  }

  // --- Loading, once per language.

  const releases = new Map();
  let shownLanguage = null;

  function render() {
    const current = releases.get(language());
    notes.replaceChildren();
    if (!current || current === 'loading') {
      release.textContent = text('loading');
      return;
    }
    if (current === 'failed') {
      release.textContent = text('failed');
      return;
    }
    const date = current.releasedAt ? new Date(current.releasedAt) : null;
    const title = document.createElement('strong');
    title.textContent = text('whatsNew', current.version);
    release.replaceChildren(title);
    if (date && !Number.isNaN(date.getTime())) {
      const when = document.createElement('span');
      when.className = 'karui-desk-date';
      when.textContent = text('released', releaseDate(date));
      release.append(when);
    }
    if (current.notes.length) notes.replaceChildren(bubble(current.notes));
  }

  async function load() {
    const wanted = language();
    shownLanguage = wanted;
    if (releases.has(wanted) && releases.get(wanted) !== 'failed') {
      render();
      return;
    }
    releases.set(wanted, 'loading');
    render();
    try {
      const response = await fetch(`${API}/api/v1/karui/latest?lang=${wanted}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data?.version || !Array.isArray(data.notes)) throw new Error('No release');
      releases.set(wanted, data);
    } catch (error) {
      releases.set(wanted, 'failed');
    }
    if (language() === wanted) render();
  }

  // --- Placement: on wide screens, under Speak on the left, or under the clocks without it.

  const clocks = document.querySelector('.clock-row');
  const speak = document.getElementById('speak');
  function place() {
    if (!clocks) return;
    let top = 36 + clocks.offsetHeight + 12;
    if (speak?.isConnected) top += speak.offsetHeight + 12;
    widget.style.setProperty('--karui-desk-top', `${top}px`);
  }

  const placement = new ResizeObserver(place);
  if (clocks) placement.observe(clocks);
  if (speak) placement.observe(speak);

  widget.querySelector('.close-box').addEventListener('click', () => {
    placement.disconnect();
    widget.remove();
  });

  document.addEventListener('site-language-change', () => {
    if (language() !== shownLanguage) load();
  });

  // Only ask the App Store once the window can be seen.
  const visibility = new IntersectionObserver((entries) => {
    if (!entries[entries.length - 1].isIntersecting) return;
    visibility.disconnect();
    load();
  });
  visibility.observe(widget);

  place();
  render();
})();
