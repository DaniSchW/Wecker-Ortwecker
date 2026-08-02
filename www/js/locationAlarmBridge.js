(function () {
  'use strict';

  // Dünner Wrapper um das native LocationAlarmBridge-Plugin (siehe
  // android/app/src/main/java/app/weckerundort/mobile/LocationAlarmBridgePlugin.java),
  // das @capacitor/local-notifications um den Vollbild-Alarm-Mechanismus
  // ergänzt (setFullScreenIntent + eigenständige Ton-/Vibrations-Steuerung),
  // den es selbst nicht anbietet. Im Browser-Vorschau überall No-Ops/leere
  // Werte, da es dort keinen Klingel-Bildschirm über dem Sperrbildschirm
  // geben kann.

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function plugin() {
    return window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.LocationAlarmBridge : null;
  }

  // Löst den Vollbild-Alarm nativ aus (Notification mit setFullScreenIntent
  // + Start von AlarmRingService). Wird von locationAlarms.js nur aufgerufen,
  // nachdem die vollständige Auslöse-Berechtigungsprüfung (Wiederholungstyp,
  // Pendel-Zeitfenster) bereits positiv war.
  function ringFullScreenAlarm(alarm, locationId, enter) {
    if (!isNative() || !plugin()) return Promise.resolve();
    return plugin()
      .ringFullScreenAlarm({
        alarmId: alarm.id,
        locationId: locationId || '',
        title: alarm.title || '',
        description: alarm.description || '',
        sound: alarm.sound || 'both',
        enter: enter !== false
      })
      .catch(function (err) {
        console.error('locationAlarmBridge: ringFullScreenAlarm fehlgeschlagen', err);
      });
  }

  function stopAlarmSound() {
    if (!isNative() || !plugin()) return Promise.resolve();
    return plugin().stopAlarmSound().catch(function () {});
  }

  // Holt einen evtl. beim kalten App-Start per Vollbild-Intent übergebenen
  // Alarm ab (einmalig, wird danach nativ geleert). Liefert null, wenn
  // keiner ansteht.
  function consumePendingAlarm() {
    if (!isNative() || !plugin()) return Promise.resolve(null);
    return plugin()
      .consumePendingAlarm()
      .then(function (data) {
        return data && data.alarmId ? data : null;
      })
      .catch(function () {
        return null;
      });
  }

  // Feuert, wenn die Activity bereits lief und über onNewIntent() erneut
  // einen Alarm-Vollbild-Intent erhalten hat (z. B. App war im Hintergrund
  // offen, Sperrbildschirm zeigt den Alarm, Nutzer tippt die Benachrichtigung an).
  function onPendingAlarm(callback) {
    if (!isNative() || !plugin()) return;
    plugin().addListener('pendingAlarm', function (data) {
      if (data && data.alarmId) callback(data);
    });
  }

  function canUseFullScreenIntent() {
    if (!isNative() || !plugin()) return Promise.resolve(true);
    return plugin()
      .canUseFullScreenIntent()
      .then(function (res) { return !res || res.allowed !== false; })
      .catch(function () { return true; });
  }

  function openFullScreenIntentSettings() {
    if (!isNative() || !plugin()) return Promise.resolve();
    return plugin().openFullScreenIntentSettings().catch(function () {});
  }

  window.locationAlarmBridge = {
    isNative: isNative,
    ringFullScreenAlarm: ringFullScreenAlarm,
    stopAlarmSound: stopAlarmSound,
    consumePendingAlarm: consumePendingAlarm,
    onPendingAlarm: onPendingAlarm,
    canUseFullScreenIntent: canUseFullScreenIntent,
    openFullScreenIntentSettings: openFullScreenIntentSettings
  };
})();
