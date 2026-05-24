(function () {
  const STORAGE_KEY = 'site-theme';

  function normalizeTheme(theme) {
    return theme === 'modern' ? 'modern' : 'classic';
  }

  function getSavedTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    } catch {
      return 'classic';
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
