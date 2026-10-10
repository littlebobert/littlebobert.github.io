// Kaketa's pages come in English, Japanese, and Tagalog: every translatable element
// carries data-label-en, data-label-ja, and data-label-fil (and data-alt-*,
// data-aria-label-* for images and controls). The select at the top switches them,
// and the choice is remembered.
(() => {
  const supported = ['en', 'ja', 'fil'];
  const select = document.getElementById('language-select');
  const key = (language) => 'label' + language.charAt(0).toUpperCase() + language.slice(1);

  function preferredLanguage() {
    for (const candidate of navigator.languages || [navigator.language || 'en']) {
      const language = candidate.toLowerCase();
      if (language.startsWith('ja')) return 'ja';
      if (language.startsWith('fil') || language.startsWith('tl')) return 'fil';
    }
    return 'en';
  }

  function setLanguage(language, persist = true) {
    const selected = supported.includes(language) ? language : 'en';
    document.querySelectorAll('[data-label-en]').forEach((element) => {
      const label = element.dataset[key(selected)] ?? element.dataset.labelEn;
      if (element instanceof HTMLMetaElement) element.content = label;
      else element.textContent = label;
    });
    document.querySelectorAll('[data-alt-en]').forEach((element) => {
      element.alt = element.dataset['alt' + selected.charAt(0).toUpperCase() + selected.slice(1)] ?? element.dataset.altEn;
    });
    document.querySelectorAll('[data-aria-label-en]').forEach((element) => {
      element.setAttribute('aria-label', element.dataset['ariaLabel' + selected.charAt(0).toUpperCase() + selected.slice(1)] ?? element.dataset.ariaLabelEn);
    });
    document.documentElement.lang = selected === 'fil' ? 'fil' : selected;
    if (select) select.value = selected;
    if (persist) {
      try { localStorage.setItem('kaketa-language', selected); } catch {}
    }
  }

  if (select) select.addEventListener('change', () => setLanguage(select.value));
  let saved = null;
  try { saved = localStorage.getItem('kaketa-language'); } catch {}
  setLanguage(saved || preferredLanguage(), false);
})();
