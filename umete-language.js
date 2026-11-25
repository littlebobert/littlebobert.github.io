// Umete's pages come in English and Japanese: every translatable element carries
// data-label-en and data-label-ja (and data-alt-* for images, data-aria-label-* for
// controls). The button at the top switches them, and the choice is remembered.
// Pages that change text on their own listen for the umete-language event.
// On umete.jp each page also has a Japanese version at /ja/…; the build names both in
// <html data-language-pages>, and the button goes to the other version instead of
// swapping in place. A Japanese page (data-page-language="ja") always shows Japanese.
(() => {
  const languageSwitch = document.querySelector('.language-switch');
  let current = 'en';

  function preferredLanguage() {
    const language = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase();
    return language.startsWith('ja') ? 'ja' : 'en';
  }

  function setLanguage(language, persist = true) {
    const selected = language === 'ja' ? 'ja' : 'en';
    document.querySelectorAll('[data-label-en][data-label-ja]').forEach((element) => {
      const label = selected === 'ja' ? element.dataset.labelJa : element.dataset.labelEn;
      if (element instanceof HTMLMetaElement) element.content = label;
      else element.textContent = label;
    });
    document.querySelectorAll('[data-alt-en][data-alt-ja]').forEach((element) => {
      element.alt = selected === 'ja' ? element.dataset.altJa : element.dataset.altEn;
    });
    document.querySelectorAll('[data-aria-label-en][data-aria-label-ja]').forEach((element) => {
      element.setAttribute('aria-label', selected === 'ja' ? element.dataset.ariaLabelJa : element.dataset.ariaLabelEn);
    });
    document.documentElement.lang = selected;
    current = selected;
    if (languageSwitch) {
      languageSwitch.textContent = selected === 'ja' ? 'English' : '日本語';
      languageSwitch.setAttribute('aria-label', selected === 'ja' ? 'Switch to English' : '日本語に切り替える');
    }
    if (persist) {
      try { localStorage.setItem('ume-language', selected); } catch {}
    }
    document.dispatchEvent(new CustomEvent('umete-language', { detail: selected }));
  }

  let languagePages = null;
  try { languagePages = JSON.parse(document.documentElement.dataset.languagePages || 'null'); } catch {}
  const normalized = (pagePath) => pagePath.replace(/(\/index)?\.html$|\/$/, '') || '/';

  function switchLanguage(language) {
    const target = languagePages?.[language];
    if (!target || normalized(target) === normalized(location.pathname)) {
      setLanguage(language);
      return;
    }
    try { localStorage.setItem('ume-language', language); } catch {}
    location.href = target + location.hash;
  }

  if (languageSwitch) languageSwitch.addEventListener('click', () => switchLanguage(current === 'ja' ? 'en' : 'ja'));
  let saved = null;
  try { saved = localStorage.getItem('ume-language'); } catch {}
  setLanguage(document.documentElement.dataset.pageLanguage || saved || preferredLanguage(), false);
})();
