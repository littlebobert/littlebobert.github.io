(function () {
  let currentLanguage = 'en';

  function setLanguage(language) {
    const labelElements = document.querySelectorAll('[data-label-en][data-label-ja]');
    const languageToggle = document.getElementById('language-toggle');

    currentLanguage = language === 'ja' ? 'ja' : 'en';
    labelElements.forEach((element) => {
      const label = element.dataset[`label${currentLanguage === 'ja' ? 'Ja' : 'En'}`];
      if (element instanceof HTMLMetaElement) {
        element.content = label;
      } else {
        element.textContent = label;
      }
    });

    document.documentElement.lang = currentLanguage;
    if (languageToggle) {
      languageToggle.textContent = currentLanguage === 'ja' ? 'English' : '日本語';
      languageToggle.setAttribute(
        'aria-label',
        currentLanguage === 'ja' ? 'Switch to English' : '日本語に切り替える'
      );
    }

    localStorage.setItem('sasu-language', currentLanguage);
  }

  function initLanguage() {
    const languageToggle = document.getElementById('language-toggle');
    if (languageToggle) {
      languageToggle.addEventListener('click', () => {
        setLanguage(currentLanguage === 'ja' ? 'en' : 'ja');
      });
    }

    const savedLanguage = localStorage.getItem('sasu-language');
    const preferredLanguage = navigator.languages?.[0] || navigator.language || 'en';
    const initialLanguage = savedLanguage || (preferredLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en');
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
