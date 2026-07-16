(function () {
  const supportedLanguages = ['en', 'ja', 'zh-Hant', 'zh-Hans'];
  const languageDatasetKeys = {
    en: 'labelEn',
    ja: 'labelJa',
    'zh-Hant': 'labelZhHant',
    'zh-Hans': 'labelZhHans',
  };
  let currentLanguage = 'en';

  function normalizedLanguage(language) {
    return supportedLanguages.includes(language) ? language : 'en';
  }

  function preferredSiteLanguage(preferredLanguage) {
    const language = preferredLanguage.toLowerCase().replaceAll('_', '-');
    if (language.startsWith('ja')) {
      return 'ja';
    }
    if (
      language.startsWith('zh-hant')
      || language === 'zh-tw'
      || language.startsWith('zh-tw-')
      || language === 'zh-hk'
      || language.startsWith('zh-hk-')
      || language === 'zh-mo'
      || language.startsWith('zh-mo-')
    ) {
      return 'zh-Hant';
    }
    if (
      language.startsWith('zh-hans')
      || language === 'zh-cn'
      || language.startsWith('zh-cn-')
      || language === 'zh-sg'
      || language.startsWith('zh-sg-')
    ) {
      return 'zh-Hans';
    }
    return 'en';
  }

  function setLanguage(language, persist = true) {
    const labelElements = document.querySelectorAll('[data-label-en][data-label-ja]');
    const languageToggle = document.getElementById('language-toggle');
    const languageSelect = document.getElementById('language-select');

    currentLanguage = normalizedLanguage(language);
    labelElements.forEach((element) => {
      const label = element.dataset[languageDatasetKeys[currentLanguage]] || element.dataset.labelEn;
      if (element instanceof HTMLMetaElement) {
        element.content = label;
      } else {
        element.textContent = label;
      }
    });

    document.documentElement.lang = currentLanguage;
    if (languageSelect) {
      languageSelect.value = currentLanguage;
    }
    if (languageToggle) {
      languageToggle.textContent = currentLanguage === 'ja' ? 'English' : '日本語';
      languageToggle.setAttribute(
        'aria-label',
        currentLanguage === 'ja' ? 'Switch to English' : '日本語に切り替える'
      );
    }

    if (persist) {
      localStorage.setItem('sasu-language', currentLanguage);
    }
  }

  function initLanguage() {
    const languageToggle = document.getElementById('language-toggle');
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
      languageSelect.addEventListener('change', () => {
        setLanguage(languageSelect.value);
      });
    }
    if (languageToggle) {
      languageToggle.addEventListener('click', () => {
        setLanguage(currentLanguage === 'ja' ? 'en' : 'ja');
      });
    }

    const savedLanguage = localStorage.getItem('sasu-language');
    const preferredLanguage = navigator.languages?.[0] || navigator.language || 'en';
    let initialLanguage = savedLanguage || preferredSiteLanguage(preferredLanguage);
    if (!languageSelect && !['en', 'ja'].includes(initialLanguage)) {
      setLanguage('en', false);
      return;
    }
    setLanguage(initialLanguage);
  }

  function inviteCodeFromLocation() {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('invite=')) {
      return decodeURIComponent(hash.slice('invite='.length)).trim();
    }

    const params = new URLSearchParams(hash);
    const hashInvite = params.get('invite');
    if (hashInvite) {
      return hashInvite.trim();
    }

    const queryInvite = new URLSearchParams(window.location.search).get('invite');
    return queryInvite ? queryInvite.trim() : '';
  }

  function initDemo() {
    const demoWindow = document.getElementById('sasu-demo-window');
    const demoStage = document.getElementById('sasu-demo-stage');
    if (!demoWindow || !demoStage) {
      return;
    }

    const demoTarget = demoStage.querySelector('.sasu-demo-target');
    let hasStarted = false;
    let reappearTimeout = null;

    const initialAnnotationDelayMs = 1200;
    const reappearDelayMs = 1500;

    const showAnnotation = () => {
      demoStage.classList.add('is-revealed');
    };

    const startDemo = () => {
      if (hasStarted) {
        return;
      }

      hasStarted = true;
      demoStage.classList.add('is-visible');

      window.setTimeout(() => {
        showAnnotation();
      }, initialAnnotationDelayMs);
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      startDemo();
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              startDemo();
              observer.disconnect();
            }
          });
        },
        { threshold: 0.35 }
      );
      observer.observe(demoWindow);
    }

    if (demoTarget) {
      demoTarget.addEventListener('click', () => {
        if (!demoStage.classList.contains('is-revealed')) {
          return;
        }

        demoStage.classList.add('is-tapped');
        window.clearTimeout(reappearTimeout);
        reappearTimeout = window.setTimeout(() => {
          demoStage.classList.remove('is-tapped');
        }, reappearDelayMs);
      });
    }
  }

  window.SasuPage = {
    currentLanguage: () => currentLanguage,
    initDemo,
    initLanguage,
    inviteCodeFromLocation,
    setLanguage,
  };
}());
