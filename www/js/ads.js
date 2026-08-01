(function () {
  'use strict';

  // Googles offizielle TEST-Ad-Unit (https://developers.google.com/admob/android/test-ads).
  // Liefert zuverlässig als "Test Ad" markierte Anzeigen, keinen echten Umsatz.
  // Vor Store-Release durch die echte Ad-Unit-ID aus dem eigenen AdMob-Konto
  // ersetzen (siehe README, Abschnitt Phase 6).
  var BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';

  var initPromise = null;
  var canRequestAds = false;
  var privacyOptionsRequired = false;
  var bannerVisible = false;

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function plugin() {
    return window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.AdMob : null;
  }

  // Reihenfolge laut Plugin-Dokumentation zwingend: initialize -> requestConsentInfo
  // -> showConsentForm (falls erforderlich) -> erst danach darf eine Anzeige
  // angefragt werden. Deutsche Zielgruppe = EWR/DSGVO, UMP-Einwilligung ist
  // daher nicht optional.
  function init() {
    if (initPromise) return initPromise;
    if (!isNative() || !plugin()) {
      initPromise = Promise.resolve();
      return initPromise;
    }

    initPromise = plugin()
      .initialize()
      .then(function () { return plugin().requestConsentInfo(); })
      .then(function (consentInfo) {
        if (consentInfo.isConsentFormAvailable && consentInfo.status === 'REQUIRED') {
          return plugin().showConsentForm();
        }
        return consentInfo;
      })
      .then(function (consentInfo) {
        canRequestAds = !!consentInfo.canRequestAds;
        privacyOptionsRequired = consentInfo.privacyOptionsRequirementStatus === 'REQUIRED';
      })
      .catch(function (err) {
        console.error('ads: Initialisierung/Einwilligung fehlgeschlagen', err);
        canRequestAds = false;
      });

    return initPromise;
  }

  function showLocationRingingBanner() {
    if (!isNative() || !plugin()) return Promise.resolve();
    return init().then(function () {
      if (!canRequestAds || bannerVisible) return;
      bannerVisible = true;
      return plugin()
        .showBanner({
          adId: BANNER_AD_UNIT_ID,
          adSize: 'MEDIUM_RECTANGLE',
          position: 'TOP_CENTER',
          margin: 0
        })
        .catch(function (err) {
          console.error('ads: showBanner fehlgeschlagen', err);
          bannerVisible = false;
        });
    });
  }

  function hideLocationRingingBanner() {
    if (!isNative() || !plugin() || !bannerVisible) return Promise.resolve();
    bannerVisible = false;
    return plugin().removeBanner().catch(function () {});
  }

  function canManagePrivacyOptions() {
    return isNative() && privacyOptionsRequired;
  }

  function openPrivacyOptions() {
    if (!isNative() || !plugin()) return Promise.resolve();
    return plugin().showPrivacyOptionsForm().catch(function (err) {
      console.error('ads: showPrivacyOptionsForm fehlgeschlagen', err);
    });
  }

  window.ads = {
    isNative: isNative,
    init: init,
    showLocationRingingBanner: showLocationRingingBanner,
    hideLocationRingingBanner: hideLocationRingingBanner,
    canManagePrivacyOptions: canManagePrivacyOptions,
    openPrivacyOptions: openPrivacyOptions
  };
})();
