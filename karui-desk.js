// Karui desk accessory: Karui's App Store listing on the desk, with the current version's release
// notes in one bubble below it. Built ahead of time into a tiny JSON summary by
// scripts/build-karui-pages.mjs (served at karui.jp/latest-release.json and data/karui-latest.json),
// with karui-changelog.html kept as a local/fallback source. Click the bubble to read every note.
(() => {
  const widget = document.getElementById('karui-desk');
  if (!widget) return;

  // Locally over HTTP, read karui-changelog.html first so unbuilt changelog edits show right away;
  // everywhere else, fetch the tiny JSON summary first (karui.jp rebuilds it on every push, and
  // allows any origin for file:// too), then fall back to the checked-in JSON and HTML.
  const localHttp = ['localhost', '127.0.0.1'].includes(location.hostname);
  const SOURCES = localHttp
    ? ['karui-changelog.html', 'data/karui-latest.json', 'https://karui.jp/latest-release.json']
    : ['https://karui.jp/latest-release.json', 'data/karui-latest.json', 'karui-changelog.html', 'https://onemorething.tokyo/karui-changelog'];

  const release = widget.querySelector('.karui-desk-release');
  const notes = widget.querySelector('.karui-desk-notes');
  const language = () => (document.documentElement.lang === 'ja' ? 'ja' : 'en');

  const TEXT = {
    whatsNew: ['What’s New in %@', '%@ の新機能'],
    loading: ['Checking the changelog…', '変更履歴を確認中…'],
    failed: ['The changelog didn’t load.', '変更履歴を読み込めませんでした。'],
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

  // --- Loading, once: the changelog has every note in both languages.

  // A build's date, as the changelog writes it in English ("November 6, 2026"), at noon in Tokyo.
  function buildDate(label) {
    const parsed = new Date(label || '');
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 3));
  }

  const noteText = (item, lang) => {
    const direct = lang === 'ja' ? item.dataset.labelJa : item.dataset.labelEn;
    if (direct !== undefined) return direct;
    if (!item.querySelector('[data-label-en]')) return item.textContent.trim();
    const clone = item.cloneNode(true);
    clone.querySelectorAll('[data-label-en]').forEach((child) => {
      const label = lang === 'ja' ? child.dataset.labelJa : child.dataset.labelEn;
      if (label !== undefined) child.textContent = label;
    });
    return clone.textContent.trim();
  };

  // The live release: the newest build whose badge isn't pending, plus the builds after the
  // release before it, leaving out "No changes since the previous build." lines.
  function liveRelease(page) {
    const headings = [...page.querySelectorAll('h2[data-karui-build]')];
    const live = headings.findIndex((heading) => {
      const badge = heading.querySelector('.store-badge');
      return badge && !badge.classList.contains('pending');
    });
    if (live < 0) return null;
    const heading = headings[live];
    const dateLabel = heading.nextElementSibling;
    const items = [];
    for (const build of headings.slice(live)) {
      if (build !== heading && build.querySelector('.store-badge')) break;
      const list = build.nextElementSibling?.nextElementSibling;
      if (list?.tagName === 'UL') items.push(...list.querySelectorAll(':scope > li:not(.no-changes)'));
    }
    const version = heading.firstChild?.textContent.trim().replace(/\s*\(\d+\)$/, '');
    if (!version) return null;
    return {
      version,
      releasedAt: dateLabel?.classList.contains('release-date')
        ? buildDate(dateLabel.dataset.labelEn ?? dateLabel.textContent) : null,
      notes: {
        en: items.map((item) => noteText(item, 'en')).filter(Boolean),
        ja: items.map((item) => noteText(item, 'ja')).filter(Boolean),
      },
    };
  }

  function releaseFromJson(data) {
    if (!data?.version || !Array.isArray(data.notes?.en) || !Array.isArray(data.notes?.ja)) return null;
    return {
      version: data.version,
      releasedAt: buildDate(data.date),
      notes: {
        en: data.notes.en.filter(Boolean),
        ja: data.notes.ja.filter(Boolean),
      },
    };
  }

  let current = null; // null, 'loading', 'failed', or the release

  function render() {
    notes.replaceChildren();
    if (!current || current === 'loading') {
      release.textContent = text('loading');
      return;
    }
    if (current === 'failed') {
      release.textContent = text('failed');
      return;
    }
    const title = document.createElement('strong');
    title.textContent = text('whatsNew', current.version);
    release.replaceChildren(title);
    if (current.releasedAt) {
      const when = document.createElement('span');
      when.className = 'karui-desk-date';
      when.textContent = text('released', releaseDate(current.releasedAt));
      release.append(when);
    }
    const items = current.notes[language()];
    if (items.length) notes.replaceChildren(bubble(items));
  }

  async function load() {
    current = 'loading';
    render();
    current = 'failed';
    for (const url of SOURCES) {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const found = url.endsWith('.json')
          ? releaseFromJson(await response.json())
          : liveRelease(new DOMParser().parseFromString(await response.text(), 'text/html'));
        if (found) {
          current = found;
          break;
        }
      } catch (error) {
        // Try the next copy.
      }
    }
    render();
  }

  // --- Placement: on wide screens, under Speak (and the seasonal Tree) on the left, or under
  // the clocks without them.

  const clocks = document.querySelector('.clock-row');
  const speak = document.getElementById('speak');
  const christmasTree = document.querySelector('.christmas-tree');
  function place() {
    if (!clocks) return;
    let top = 36 + clocks.offsetHeight + 12;
    if (speak?.isConnected) top += speak.offsetHeight + 12;
    if (christmasTree?.isConnected) top += christmasTree.offsetHeight + 12;
    widget.style.setProperty('--karui-desk-top', `${top}px`);
  }

  const placement = new ResizeObserver(place);
  if (clocks) placement.observe(clocks);
  if (speak) placement.observe(speak);
  if (christmasTree) placement.observe(christmasTree);
  document.addEventListener('christmas-tree-layout', place);
  document.addEventListener('desk-layout', place);

  widget.querySelector('.close-box').addEventListener('click', () => {
    placement.disconnect();
    widget.remove();
    document.dispatchEvent(new Event('desk-layout'));
  });

  // Both languages are already loaded; a failed load tries again.
  document.addEventListener('site-language-change', () => {
    if (current === 'failed') load();
    else render();
  });

  // Only read the changelog once the window can be seen.
  const visibility = new IntersectionObserver((entries) => {
    if (!entries[entries.length - 1].isIntersecting) return;
    visibility.disconnect();
    load();
  });
  visibility.observe(widget);

  place();
  render();
})();
