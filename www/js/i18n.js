(function () {
  'use strict';

  var SUPPORTED_LOCALES = ['de', 'en'];
  var DEFAULT_LOCALE = 'de';
  var STORAGE_KEY = 'wo.locale';

  var strings = {};
  var currentLocale = DEFAULT_LOCALE;

  function detectLocale() {
    var stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      /* localStorage unavailable */
    }
    if (stored && SUPPORTED_LOCALES.indexOf(stored) !== -1) {
      return stored;
    }
    var nav = (navigator.language || DEFAULT_LOCALE).slice(0, 2).toLowerCase();
    return SUPPORTED_LOCALES.indexOf(nav) !== -1 ? nav : DEFAULT_LOCALE;
  }

  function loadLocale(locale) {
    return fetch('i18n/' + locale + '.json')
      .then(function (res) {
        if (!res.ok) {
          throw new Error('i18n: could not load locale "' + locale + '"');
        }
        return res.json();
      })
      .then(function (json) {
        strings = json;
        currentLocale = locale;
        document.documentElement.setAttribute('lang', locale);
      });
  }

  function t(key) {
    return Object.prototype.hasOwnProperty.call(strings, key) ? strings[key] : key;
  }

  function applyTranslations(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
  }

  function setLocale(locale) {
    if (SUPPORTED_LOCALES.indexOf(locale) === -1) {
      return Promise.reject(new Error('i18n: unsupported locale "' + locale + '"'));
    }
    return loadLocale(locale).then(function () {
      try {
        localStorage.setItem(STORAGE_KEY, locale);
      } catch (e) {
        /* localStorage unavailable */
      }
      applyTranslations();
    });
  }

  function init() {
    return loadLocale(detectLocale()).then(function () {
      applyTranslations();
    });
  }

  window.i18n = {
    init: init,
    t: t,
    setLocale: setLocale,
    applyTranslations: applyTranslations,
    getLocale: function () {
      return currentLocale;
    },
    supportedLocales: SUPPORTED_LOCALES.slice()
  };
})();
