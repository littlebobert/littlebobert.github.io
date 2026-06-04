(function () {
  const STORAGE_KEY = 'site-theme-v2';
  const LEGACY_STORAGE_KEY = 'site-theme';
  const THEMES = ['bw', 'classic', 'modern'];

  function normalizeTheme(theme) {
    return THEMES.includes(theme) ? theme : 'bw';
  }

  function getSavedTheme() {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY);
      if (savedTheme) {
        return normalizeTheme(savedTheme);
      }

      return localStorage.getItem(LEGACY_STORAGE_KEY) === 'modern' ? 'modern' : 'bw';
    } catch {
      return 'bw';
    }
  }

  function syncThemeRadios(theme) {
    document.querySelectorAll('input[name="site-theme"]').forEach((radio) => {
      radio.checked = radio.value === theme;
    });
  }

  function syncThemeSegments(theme) {
    document.querySelectorAll('.appearance-segment').forEach((button) => {
      const isActive = button.dataset.themeValue === theme;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function setSiteTheme(theme) {
    const value = normalizeTheme(theme);
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {}
    syncThemeRadios(value);
    syncThemeSegments(value);
    document.dispatchEvent(new CustomEvent('site-theme-change', { detail: { theme: value } }));
  }

  setSiteTheme(getSavedTheme());

  window.setSiteTheme = setSiteTheme;

  window.initSiteTheme = function initSiteTheme() {
    const theme = getSavedTheme();
    syncThemeRadios(theme);
    syncThemeSegments(theme);
    document.querySelectorAll('input[name="site-theme"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          setSiteTheme(radio.value);
        }
      });
    });
    document.querySelectorAll('.appearance-segment').forEach((button) => {
      button.addEventListener('click', () => {
        setSiteTheme(button.dataset.themeValue);
      });
    });
  };
})();
