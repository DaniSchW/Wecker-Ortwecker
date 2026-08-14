(function () {
  'use strict';

  // Echte Ad-Unit aus dem eigenen AdMob-Konto (ersetzt die vorherige
  // Google-Test-Ad-Unit aus Phase 6).
  var BANNER_AD_UNIT_ID = 'ca-app-pub-8453553622026562/4356031602';

  // 'ADAPTIVE_BANNER' lässt @capacitor-community/admob intern exakt
  // AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize() aufrufen
  // (siehe BannerExecutor.java im Plugin) - die volle Bildschirmbreite wird
  // dabei automatisch verwendet, Google berechnet dazu passend die Höhe.
  //
  // WICHTIG - technische Grenze dieses Plugins: Es gibt in seiner API
  // (BannerAdOptions.adSize) NUR die hier verfügbaren, festen Enum-Werte;
  // eine eigene Pixel-/dp-Höhe (z. B. "exakt 50% Bildschirmhöhe") lässt sich
  // darüber nicht an die native AdView übergeben - das AdMob-SDK selbst
  // kennt für Banner-Anzeigen nur Standardformate + adaptive Formate mit von
  // Google berechneter Höhe, kein "beliebige Höhe"-Format. Weder
  // ADAPTIVE_BANNER (i. d. R. 50-100dp) noch das vorher genutzte
  // MEDIUM_RECTANGLE (fix 250dp) füllen also tatsächlich 50% der
  // Bildschirmhöhe aus. Die per CSS exakt auf 50% fixierte Fläche
  // (.ringing-ad, www/css/style.css - gilt für beide Klingel-Bildschirme)
  // ist daher bewusst eine obere Begrenzung/reservierte Fläche, in der die
  // Anzeige oben verankert wird -
  // nicht die tatsächliche Anzeigengröße selbst. Eine Anzeige, die
  // buchstäblich 50% Bildschirmhöhe ausfüllt, wäre technisch kein
  // AdMob-Banner mehr, sondern ein anderer Anzeigentyp (z. B. Interstitial)
  // oder würde eine eigene, native Erweiterung dieses Plugins erfordern.
  var BANNER_AD_SIZE = 'ADAPTIVE_BANNER';
  var BANNER_POSITION = 'TOP_CENTER';

  // Ein per preload geladener, aber noch nicht gezeigter Banner wird beim
  // tatsächlichen Klingeln wiederverwendet (resumeBanner statt neuem
  // showBanner - deutlich schneller). Ist das Vorladen länger her als dieser
  // Schwellwert, wird stattdessen eine frische Anzeige geladen, damit keine
  // stark veraltete Anzeige gezeigt wird (Orts-Zeit-Wecker können Stunden
  // nach dem Scharfschalten auslösen - das ist bewusst ein Kompromiss, keine
  // von Google vorgegebene Regel; vor Live-Schaltung gegenprüfen, siehe
  // README, Abschnitt "Phase 6 Ergänzung").
  var MAX_PRELOAD_AGE_MS = 30 * 60 * 1000;

  // Wie lange showRingingBanner() maximal auf eine noch laufende Ladung
  // wartet, bevor auf die neutrale Fallback-Anzeige (siehe ringing.js/
  // locationRinging.js) ausgewichen wird, damit der Klingel-Bildschirm nicht
  // wegen einer langsamen/fehlenden Internetverbindung blockiert.
  var SHOW_WAIT_TIMEOUT_MS = 4000;

  var initPromise = null;
  var canRequestAds = false;
  var privacyOptionsRequired = false;
  var showToken = 0;

  // idle: nichts geladen | loading: showBanner() laeuft | ready: geladen,
  // aber versteckt (preload) | visible: aktuell sichtbar | failed: letzter
  // Ladeversuch fehlgeschlagen
  var bannerState = 'idle';
  var preloadedAt = 0;
  var loadWaiters = [];
  var eventsWired = false;

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function plugin() {
    return window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.AdMob : null;
  }

  // Werbefrei-Status des Pro-Abos (siehe www/js/billing.js) - alle Aufrufer
  // prüfen bereits vorher hier, sodass ein aktives Abo automatisch jede
  // Anzeigenanfrage unterdrückt.
  function hasAdFreePurchase() {
    return window.billing.isPro();
  }

  // Reihenfolge laut Plugin-Dokumentation zwingend: initialize -> requestConsentInfo
  // -> showConsentForm (falls erforderlich) -> erst danach darf eine Anzeige
  // angefragt werden. Deutsche Zielgruppe = EWR/DSGVO, UMP-Einwilligung ist
  // daher nicht optional.
  function init() {
    if (initPromise) return initPromise;
    wirePurchaseEvents();
    if (!isNative() || !plugin()) {
      initPromise = Promise.resolve();
      return initPromise;
    }

    wireBannerEvents();

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

  // Entfernt einen gerade sichtbaren oder vorgeladenen Banner sofort, wenn
  // waehrenddessen ein Pro-Abo-Kauf abgeschlossen wird (siehe
  // www/js/billing.js) - ohne das wuerde eine schon geladene Anzeige bis zum
  // naechsten preload/showRingingBanner()-Aufruf weiter angezeigt bleiben,
  // obwohl hasAdFreePurchase() ab sofort true liefert.
  function wirePurchaseEvents() {
    window.billing.onStatusChange(function (active) {
      if (!active || !isNative() || !plugin()) return;
      if (bannerState === 'visible' || bannerState === 'ready') {
        plugin().removeBanner().catch(function () {});
        bannerState = 'idle';
      }
    });
  }

  function wireBannerEvents() {
    if (eventsWired) return;
    eventsWired = true;
    plugin().addListener('bannerAdLoaded', function () {
      if (bannerState === 'loading') bannerState = 'ready';
      resolveLoadWaiters(true);
    });
    plugin().addListener('bannerAdFailedToLoad', function (err) {
      console.error('ads: bannerAdFailedToLoad', err);
      bannerState = 'failed';
      resolveLoadWaiters(false);
    });
  }

  function resolveLoadWaiters(success) {
    var waiters = loadWaiters;
    loadWaiters = [];
    waiters.forEach(function (resolve) { resolve(success); });
  }

  function waitForLoad(timeoutMs) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(false);
      }, timeoutMs);
      loadWaiters.push(function (success) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(success);
      });
    });
  }

  // Startet einen neuen Ladevorgang (nicht sichtbar). Der eigentliche
  // Ladeabschluss kommt asynchron über die bannerAdLoaded/-FailedToLoad
  // Events (siehe wireBannerEvents) - das Promise von showBanner() selbst
  // sagt nur aus, dass der native Aufruf angenommen wurde, nicht dass die
  // Anzeige schon da ist.
  function beginLoad() {
    bannerState = 'loading';
    return plugin()
      .showBanner({ adId: BANNER_AD_UNIT_ID, adSize: BANNER_AD_SIZE, position: BANNER_POSITION, margin: 0 })
      .then(function () { return plugin().hideBanner(); })
      .catch(function (err) {
        console.error('ads: showBanner fehlgeschlagen', err);
        bannerState = 'failed';
        resolveLoadWaiters(false);
      });
  }

  // Lädt einen Banner im Voraus (versteckt), sobald mindestens ein Wecker
  // oder Orts-Zeit-Wecker scharf ist - reduziert die Wartezeit beim
  // tatsächlichen Auslösen. Bei Orts-Zeit-Weckern ist der Zeitpunkt ja nicht
  // vorhersehbar (Geofencing); bei Standard-Weckern wäre er zwar bekannt,
  // aber derselbe, bereits vorhandene Vorlade-Mechanismus wird hier bewusst
  // wiederverwendet statt einen zweiten, zeitgesteuerten einzuführen - ein
  // einziger geladener/wiederverwendbarer Banner reicht für beide Screens,
  // da immer nur einer der beiden Klingel-Bildschirme gleichzeitig sichtbar
  // sein kann.
  function preloadRingingBanner() {
    if (!isNative() || !plugin() || hasAdFreePurchase()) return Promise.resolve();
    return init().then(function () {
      if (!canRequestAds) return;
      if (bannerState === 'loading' || bannerState === 'ready' || bannerState === 'visible') return;
      preloadedAt = Date.now();
      return beginLoad();
    });
  }

  // Zeigt den Banner im Klingel-Bildschirm (Standard-Wecker oder
  // Orts-Zeit-Wecker). Löst zu true auf, wenn eine Anzeige sichtbar ist,
  // sonst false (Aufrufer zeigt dann die neutrale Fallback-Fläche statt
  // eines leeren Bereichs).
  function showRingingBanner() {
    if (!isNative() || !plugin()) return Promise.resolve(false);
    // init() (insb. die DSGVO-Einwilligung) kann beliebig lange auf eine
    // Nutzerinteraktion warten. showToken sorgt dafuer, dass ein
    // zwischenzeitliches hideRingingBanner() (Alarm bereits weggewischt)
    // diese verspaetete Anfrage nicht mehr in einen sichtbaren Banner
    // muenden laesst.
    var myToken = ++showToken;
    return init().then(function () {
      if (myToken !== showToken || !canRequestAds || hasAdFreePurchase()) return false;

      var preloadStillFresh = bannerState === 'ready' && Date.now() - preloadedAt < MAX_PRELOAD_AGE_MS;
      if (preloadStillFresh) {
        return resumeVisible(myToken);
      }

      if (bannerState === 'ready') {
        // Vorgeladene Anzeige ist zu alt - verwerfen und frisch laden.
        plugin().removeBanner().catch(function () {});
        bannerState = 'idle';
      }

      if (bannerState === 'idle' || bannerState === 'failed') {
        beginLoad();
      }
      // bannerState ist jetzt 'loading' (frisch gestartet oder von preload
      // schon in Arbeit) - kurz auf Fertigstellung warten statt den
      // Auslöse-Bildschirm unbegrenzt zu blockieren.
      return waitForLoad(SHOW_WAIT_TIMEOUT_MS).then(function (loaded) {
        if (myToken !== showToken) return false;
        if (!loaded) return false;
        return resumeVisible(myToken);
      });
    });
  }

  function resumeVisible(myToken) {
    bannerState = 'visible';
    return plugin()
      .resumeBanner()
      .then(function () { return myToken === showToken; })
      .catch(function (err) {
        console.error('ads: resumeBanner fehlgeschlagen', err);
        bannerState = 'failed';
        return false;
      });
  }

  function hideRingingBanner() {
    showToken++;
    if (!isNative() || !plugin() || bannerState !== 'visible') return Promise.resolve();
    // hideBanner (nicht removeBanner) haelt die geladene Anzeige fuer die
    // Wiederverwendung beim naechsten Klingeln vor (siehe MAX_PRELOAD_AGE_MS).
    bannerState = 'ready';
    preloadedAt = Date.now();
    return plugin().hideBanner().catch(function () {});
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
    hasAdFreePurchase: hasAdFreePurchase,
    preloadRingingBanner: preloadRingingBanner,
    showRingingBanner: showRingingBanner,
    hideRingingBanner: hideRingingBanner,
    canManagePrivacyOptions: canManagePrivacyOptions,
    openPrivacyOptions: openPrivacyOptions
  };
})();
