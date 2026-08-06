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
  // + Start von AlarmRingService, der den kompletten Klingeln-Pause-Zyklus
  // eigenständig verwaltet, siehe AlarmRingService.java). Gilt für BEIDE
  // Alarm-Arten - options.kind unterscheidet ("standard"|"location"). Wird
  // von alarms.js/locationAlarms.js nur aufgerufen, nachdem für
  // Orts-Zeit-Wecker die vollständige Auslöse-Berechtigungsprüfung
  // (Wiederholungstyp, Pendel-Zeitfenster) bereits positiv war.
  function ringFullScreenAlarm(options) {
    if (!isNative() || !plugin()) return Promise.resolve();
    var ring = window.ringSettings.resolveForAlarm(options.alarm);
    return plugin()
      .ringFullScreenAlarm({
        kind: options.kind,
        alarmId: options.alarm.id,
        locationId: options.locationId || '',
        title: options.alarm.title || options.alarm.label || '',
        description: options.alarm.description || '',
        sound: options.alarm.sound || 'both',
        enter: options.enter !== false,
        ringDurationSec: ring.ringDurationSec,
        pauseDurationSec: ring.pauseDurationSec,
        maxCycles: ring.maxCycles
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

  // Dauerhafter Keep-alive-Foreground-Service (GeofenceForegroundService) -
  // laeuft, solange mindestens ein Orts-Zeit-Wecker aktiviert ist (siehe
  // locationAlarms.js's syncTracking()).
  function startGeofenceService() {
    if (!isNative() || !plugin()) return Promise.resolve();
    return plugin().startGeofenceService().catch(function () {});
  }

  function stopGeofenceService() {
    if (!isNative() || !plugin()) return Promise.resolve();
    return plugin().stopGeofenceService().catch(function () {});
  }

  function isIgnoringBatteryOptimizations() {
    if (!isNative() || !plugin()) return Promise.resolve(true);
    return plugin()
      .isIgnoringBatteryOptimizations()
      .then(function (res) { return !!res && res.ignoring !== false; })
      .catch(function () { return true; });
  }

  function requestIgnoreBatteryOptimizations() {
    if (!isNative() || !plugin()) return Promise.resolve();
    return plugin().requestIgnoreBatteryOptimizations().catch(function () {});
  }

  // Feuert, wenn AlarmRingService alle Klingel-Zyklen ohne Nutzer-Interaktion
  // durchlaufen hat (siehe AlarmRingService.finishSession()) - ringing.js/
  // locationRinging.js schließen daraufhin ein noch offenes Overlay
  // automatisch (siehe deren closeIfActive()).
  function onAlarmExpired(callback) {
    if (!isNative() || !plugin()) return;
    plugin().addListener('alarmExpired', function (data) {
      if (data && data.alarmId) callback(data);
    });
  }

  window.locationAlarmBridge = {
    isNative: isNative,
    ringFullScreenAlarm: ringFullScreenAlarm,
    stopAlarmSound: stopAlarmSound,
    consumePendingAlarm: consumePendingAlarm,
    onPendingAlarm: onPendingAlarm,
    onAlarmExpired: onAlarmExpired,
    canUseFullScreenIntent: canUseFullScreenIntent,
    openFullScreenIntentSettings: openFullScreenIntentSettings,
    startGeofenceService: startGeofenceService,
    stopGeofenceService: stopGeofenceService,
    isIgnoringBatteryOptimizations: isIgnoringBatteryOptimizations,
    requestIgnoreBatteryOptimizations: requestIgnoreBatteryOptimizations
  };
})();
