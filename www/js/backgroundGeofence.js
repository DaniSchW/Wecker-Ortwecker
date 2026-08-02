(function () {
  'use strict';

  var SEPARATOR = '::';
  var transitionCallback = null;
  var setupDone = false;

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function plugin() {
    return window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.BackgroundGeolocation : null;
  }

  function isAvailable() {
    return isNative() && !!plugin();
  }

  function makeIdentifier(alarmId, locationId) {
    return alarmId + SEPARATOR + locationId;
  }

  function parseIdentifier(identifier) {
    var idx = identifier.indexOf(SEPARATOR);
    if (idx === -1) return null;
    return { alarmId: identifier.slice(0, idx), locationId: identifier.slice(idx + SEPARATOR.length) };
  }

  function checkPermissions() {
    if (!isAvailable()) return Promise.resolve(null);
    return plugin().checkPermissions().catch(function () { return null; });
  }

  function requestBackgroundPermission() {
    if (!isAvailable()) return Promise.resolve(null);
    return plugin()
      .requestPermissions({ permissions: ['location', 'backgroundLocation', 'notification'] })
      .catch(function () { return null; });
  }

  function openSettings() {
    if (!isAvailable()) return Promise.resolve();
    return plugin().openSettings().catch(function () {});
  }

  function ensureSetup() {
    if (setupDone || !isAvailable()) return Promise.resolve();
    setupDone = true;
    return plugin()
      .setupGeofencing({
        notifyOnEntry: true,
        notifyOnExit: true,
        backgroundLocation: true,
        requestPermissions: false
      })
      .catch(function (err) {
        console.error('backgroundGeofence: setupGeofencing fehlgeschlagen', err);
      });
  }

  // Ersetzt den kompletten Satz nativ überwachter Orte durch die aktuell
  // aktiven Orts-Zeit-Wecker. Einfach gehalten (statt Diffing), da die Anzahl
  // der Orte bei einer persönlichen App weit unter dem Android-Limit von 100
  // Geofences liegt.
  function syncGeofences(alarms) {
    if (!isAvailable()) return Promise.resolve();
    return ensureSetup().then(function () {
      return plugin()
        .removeAllGeofences()
        .catch(function () {})
        .then(function () {
          var jobs = [];
          alarms.forEach(function (alarm) {
            if (!alarm.enabled || !alarm.locations) return;
            alarm.locations.forEach(function (loc) {
              jobs.push(
                plugin()
                  .addGeofence({
                    identifier: makeIdentifier(alarm.id, loc.id),
                    latitude: loc.lat,
                    longitude: loc.lng,
                    radius: alarm.radius || 150,
                    // Wird vom Plugin pro Region gespeichert und bei einer
                    // Transition unverändert mitgeliefert (siehe
                    // GeofenceStore.buildTransitionData im Plugin) - so
                    // kennt die native Vollbild-Alarm-Bridge (siehe
                    // LocationAlarmNotifier) Titel/Beschreibung/Ton-
                    // Einstellung auch dann, wenn der App-Prozess beim
                    // Auslösen bereits beendet war und kein JS läuft.
                    payload: {
                      alarmId: alarm.id,
                      locationId: loc.id,
                      title: alarm.title || '',
                      description: alarm.description || '',
                      sound: alarm.sound || 'both'
                    }
                  })
                  .catch(function (err) {
                    console.error('backgroundGeofence: addGeofence fehlgeschlagen', alarm.id, loc.id, err);
                  })
              );
            });
          });
          return Promise.all(jobs);
        });
    });
  }

  function onTransition(callback) {
    transitionCallback = callback;
    if (!isAvailable()) return;
    plugin().addListener('geofenceTransition', function (event) {
      var parsed = parseIdentifier(event.identifier);
      if (!parsed || !transitionCallback) return;
      transitionCallback(parsed.alarmId, parsed.locationId, event.enter);
    });
    plugin().addListener('geofenceError', function (event) {
      console.error('backgroundGeofence: geofenceError', event);
    });
  }

  window.backgroundGeofence = {
    isAvailable: isAvailable,
    checkPermissions: checkPermissions,
    requestBackgroundPermission: requestBackgroundPermission,
    openSettings: openSettings,
    syncGeofences: syncGeofences,
    onTransition: onTransition
  };
})();
