(function () {
  'use strict';

  // Dünner Wrapper um das native BillingBridge-Plugin (siehe
  // android/app/src/main/java/app/weckerundort/mobile/BillingBridgePlugin.java).
  // Kauf/Verwaltung des werbefreien Pro-Jahres-Abos laufen vollständig über
  // Google Play Billing - dieses Modul hält lediglich einen synchron
  // abfragbaren, lokal zwischengespeicherten Status vor (isPro()), analog zum
  // canRequestAds-Muster in ads.js, damit ads.js's hasAdFreePurchase() nicht
  // auf ein Promise warten muss.

  var proActive = false;
  var listeners = [];

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function plugin() {
    return window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.BillingBridge : null;
  }

  function setActive(active) {
    if (proActive === !!active) return;
    proActive = !!active;
    listeners.forEach(function (cb) { cb(proActive); });
  }

  function isPro() {
    return proActive;
  }

  function onStatusChange(callback) {
    listeners.push(callback);
  }

  // Fragt den aktuellen Abo-Status beim Play-Store-eigenen BillingClient ab
  // (funktioniert auch nach Neuinstallation, da am Google-Konto haengend)
  // und hört danach auf proStatusChanged-Events (z. B. nach einem frisch
  // abgeschlossenen Kauf).
  function init() {
    if (!isNative() || !plugin()) return Promise.resolve();
    plugin().addListener('proStatusChanged', function (data) {
      setActive(data && data.active);
    });
    return plugin()
      .getStatus()
      .then(function (data) { setActive(data && data.active); })
      .catch(function (err) {
        console.error('billing: getStatus fehlgeschlagen', err);
      });
  }

  function purchase() {
    if (!isNative() || !plugin()) return Promise.reject(new Error('nicht verfügbar'));
    return plugin().purchase();
  }

  function openManageSubscription() {
    if (!isNative() || !plugin()) return Promise.resolve();
    return plugin().openManageSubscription().catch(function () {});
  }

  window.billing = {
    isNative: isNative,
    init: init,
    isPro: isPro,
    onStatusChange: onStatusChange,
    purchase: purchase,
    openManageSubscription: openManageSubscription
  };
})();
