const CLOCK_MODE_STORAGE_KEY = 'clock-display-mode';
const WEATHER_UNIT_STORAGE_KEY = 'weather-unit';
const LANGUAGE_STORAGE_KEY = 'site-language';
const KYOTO_LOCATION = {
  latitude: 35.0116,
  longitude: 135.7681,
};

const clockModeButtons = document.querySelectorAll('.clock-mode-segment');
const weatherUnitButtons = document.querySelectorAll('.weather-unit-segment');
const languageButtons = document.querySelectorAll('.language-segment');
const labelElements = document.querySelectorAll('[data-label-en][data-label-ja]');
let currentWeatherUnit = 'imperial';
let currentLanguage = 'en';
let kyotoWeatherReading = null;
let lastTouchWindowShadeAt = 0;

function timeInZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const n = (type) => {
    const p = parts.find((x) => x.type === type);
    return p ? String(Number(p.value)).padStart(2, '0') : '00';
  };
  return { h: n('hour'), m: n('minute'), s: n('second') };
}

function updateAnalogClock(prefix, time) {
  const hourHand = document.getElementById(`${prefix}-analog-hour`);
  const minuteHand = document.getElementById(`${prefix}-analog-minute`);
  const secondHand = document.getElementById(`${prefix}-analog-second`);
  if (!hourHand || !minuteHand || !secondHand) {
    return;
  }

  const hour = Number(time.h);
  const minute = Number(time.m);
  const second = Number(time.s);
  const hourDeg = ((hour % 12) + minute / 60 + second / 3600) * 30;
  const minuteDeg = (minute + second / 60) * 6;
  const secondDeg = second * 6;

  hourHand.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
  minuteHand.style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
  secondHand.style.transform = `translateX(-50%) rotate(${secondDeg}deg)`;
}

function updateKyotoClock() {
  const kyoto = timeInZone(new Date(), 'Asia/Tokyo');
  document.getElementById('kyoto-hours').textContent = kyoto.h;
  document.getElementById('kyoto-minutes').textContent = kyoto.m;
  document.getElementById('kyoto-seconds').textContent = kyoto.s;
  updateAnalogClock('kyoto', kyoto);
}

function normalizeClockMode(mode) {
  return mode === 'analog' ? 'analog' : 'digital';
}

function normalizeWeatherUnit(unit) {
  return unit === 'metric' ? 'metric' : 'imperial';
}

function getSavedClockMode() {
  try {
    return normalizeClockMode(localStorage.getItem(CLOCK_MODE_STORAGE_KEY));
  } catch {
    return 'digital';
  }
}

function setClockMode(mode) {
  const value = normalizeClockMode(mode);
  document.documentElement.dataset.clockMode = value;
  try {
    localStorage.setItem(CLOCK_MODE_STORAGE_KEY, value);
  } catch {}
  clockModeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.clockModeValue === value ? 'true' : 'false');
  });
}

function getSavedWeatherUnit() {
  try {
    return normalizeWeatherUnit(localStorage.getItem(WEATHER_UNIT_STORAGE_KEY));
  } catch {
    return 'imperial';
  }
}

function setWeatherUnit(unit) {
  currentWeatherUnit = normalizeWeatherUnit(unit);
  try {
    localStorage.setItem(WEATHER_UNIT_STORAGE_KEY, currentWeatherUnit);
  } catch {}
  weatherUnitButtons.forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.weatherUnitValue === currentWeatherUnit ? 'true' : 'false');
  });
  renderWeather();
}

function formatTemperature(celsius) {
  if (typeof celsius !== 'number') {
    return '-';
  }
  if (currentWeatherUnit === 'metric') {
    return `${Math.round(celsius)}C`;
  }
  return `${Math.round((celsius * 9) / 5 + 32)}F`;
}

function weatherCodeLabel(code) {
  if (code === 0) return currentLanguage === 'ja' ? '晴れ' : 'Clear';
  if ([1, 2, 3].includes(code)) return currentLanguage === 'ja' ? 'くもり' : 'Clouds';
  if ([45, 48].includes(code)) return currentLanguage === 'ja' ? '霧' : 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return currentLanguage === 'ja' ? '霧雨' : 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return currentLanguage === 'ja' ? '雨' : 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return currentLanguage === 'ja' ? '雪' : 'Snow';
  if ([95, 96, 99].includes(code)) return currentLanguage === 'ja' ? '雷雨' : 'Storm';
  return currentLanguage === 'ja' ? '天気' : 'Weather';
}

function renderWeather() {
  const element = document.getElementById('kyoto-weather');
  if (!element) {
    return;
  }
  if (!kyotoWeatherReading) {
    element.textContent = '-';
    return;
  }
  element.textContent = `${formatTemperature(kyotoWeatherReading.temperatureC)} ${weatherCodeLabel(kyotoWeatherReading.weatherCode)}`;
}

async function fetchWeather() {
  const element = document.getElementById('kyoto-weather');
  try {
    const params = new URLSearchParams({
      latitude: KYOTO_LOCATION.latitude,
      longitude: KYOTO_LOCATION.longitude,
      current: 'temperature_2m,weather_code',
      temperature_unit: 'celsius',
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) {
      throw new Error(`Weather request failed: ${response.status}`);
    }
    const data = await response.json();
    kyotoWeatherReading = {
      temperatureC: data.current?.temperature_2m,
      weatherCode: data.current?.weather_code,
    };
    renderWeather();
  } catch (error) {
    kyotoWeatherReading = null;
    if (element) {
      element.textContent = '-';
    }
  }
}

function setLanguage(language) {
  currentLanguage = language === 'ja' ? 'ja' : 'en';
  labelElements.forEach((element) => {
    element.innerHTML = element.dataset[`label${currentLanguage === 'ja' ? 'Ja' : 'En'}`];
  });

  document.documentElement.lang = currentLanguage;
  languageButtons.forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.languageValue === currentLanguage ? 'true' : 'false');
  });
  document.title = currentLanguage === 'ja' ? '京都コミュニティハックデー' : 'Kyoto Community Hack Day';
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  } catch {}
  renderWeather();
}

function getInitialLanguage() {
  try {
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage === 'en' || savedLanguage === 'ja') {
      return savedLanguage;
    }
  } catch {}
  const preferredLanguage = navigator.languages?.[0] || navigator.language || 'en';
  return preferredLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

function toggleWindowShade(windowElement) {
  windowElement?.classList.toggle('window-shaded');
}

function preventPageDoubleTapZoom(event) {
  if (event.changedTouches.length !== 1) {
    return;
  }

  const touch = event.changedTouches[0];
  const now = performance.now();
  const lastTap = preventPageDoubleTapZoom.lastTap;
  const wasDoubleTap = lastTap
    && now - lastTap.time < 320
    && Math.hypot(touch.clientX - lastTap.clientX, touch.clientY - lastTap.clientY) < 28;

  if (wasDoubleTap) {
    if (event.cancelable) {
      event.preventDefault();
    }
    const titleBar = event.target.closest?.('.title-bar, .clock-title-bar');
    if (titleBar) {
      lastTouchWindowShadeAt = now;
      toggleWindowShade(titleBar.closest('.mac-dialog, .clock-widget'));
    }
    preventPageDoubleTapZoom.lastTap = null;
    return;
  }

  preventPageDoubleTapZoom.lastTap = {
    time: now,
    clientX: touch.clientX,
    clientY: touch.clientY,
  };
}

clockModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setClockMode(button.dataset.clockModeValue);
    button.blur();
  });
});

weatherUnitButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setWeatherUnit(button.dataset.weatherUnitValue);
    button.blur();
  });
});

languageButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setLanguage(button.dataset.languageValue);
    button.blur();
  });
});

document.querySelectorAll('.title-bar, .clock-title-bar').forEach((titleBar) => {
  const windowElement = titleBar.closest('.mac-dialog, .clock-widget');
  if (!windowElement) {
    return;
  }

  titleBar.title = 'Double-click for WindowShade';
  titleBar.addEventListener('dblclick', () => {
    if (performance.now() - lastTouchWindowShadeAt < 500) {
      return;
    }
    toggleWindowShade(windowElement);
  });
});

document.addEventListener('touchend', preventPageDoubleTapZoom, { passive: false });

setLanguage(getInitialLanguage());
setClockMode(getSavedClockMode());
setWeatherUnit(getSavedWeatherUnit());
updateKyotoClock();
fetchWeather();
setInterval(updateKyotoClock, 1000);
setInterval(fetchWeather, 30 * 60 * 1000);
