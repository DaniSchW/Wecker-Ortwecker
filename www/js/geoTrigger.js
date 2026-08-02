(function () {
  'use strict';

  var watchHandle = null;
  var triggerCallback = null;
  var checking = false;

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function geolocationPlugin() {
    return window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.Geolocation : null;
  }

  function requestPermissions() {
    if (isNative()) {
      var plugin = geolocationPlugin();
      if (plugin && plugin.requestPermissions) {
        return plugin.requestPermissions().then(function (res) {
          return res && (res.location === 'granted' || res.coarseLocation === 'granted');
        }).catch(function () { return false; });
      }
      return Promise.resolve(false);
    }
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(false);
      navigator.geolocation.getCurrentPosition(
        function () { resolve(true); },
        function () { resolve(false); },
        { timeout: 8000 }
      );
    });
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function dailyKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  function isoWeekKey(d) {
    var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return date.getUTCFullYear() + '-W' + pad2(weekNo);
  }

  function monthlyKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }

  function periodAllows(alarm, now) {
    switch (alarm.repeatType) {
      case 'once':
        return !alarm.consumed;
      case 'permanent':
        return true;
      case 'periodic': {
        var unit = alarm.periodicUnit || 'daily';
        if (unit === 'custom') {
          if (!alarm.lastTriggeredAt) return true;
          var days = Math.max(1, parseInt(alarm.periodicCustomDays, 10) || 1);
          var elapsedMs = now.getTime() - alarm.lastTriggeredAt;
          return elapsedMs >= days * 86400000;
        }
        var key = unit === 'weekly' ? isoWeekKey(now) : unit === 'monthly' ? monthlyKey(now) : dailyKey(now);
        return alarm.lastTriggeredPeriodKey !== key;
      }
      default:
        return true;
    }
  }

  function commuteAllows(alarm, now) {
    var commute = alarm.commute;
    if (!commute || !commute.enabled) return true;
    if (commute.weekdays && commute.weekdays.length && commute.weekdays.indexOf(now.getDay()) === -1) return false;
    if (commute.start && commute.end) {
      var mins = now.getHours() * 60 + now.getMinutes();
      var startMins = toMinutes(commute.start);
      var endMins = toMinutes(commute.end);
      if (startMins <= endMins) {
        if (mins < startMins || mins > endMins) return false;
      } else {
        // Fenster über Mitternacht hinweg
        if (mins < startMins && mins > endMins) return false;
      }
    }
    return true;
  }

  function toMinutes(hhmm) {
    var parts = hhmm.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function markTriggered(alarm, now) {
    alarm.consumed = alarm.repeatType === 'once' ? true : alarm.consumed;
    alarm.lastTriggeredAt = now.getTime();
    if (alarm.repeatType === 'periodic') {
      var unit = alarm.periodicUnit || 'daily';
      alarm.lastTriggeredPeriodKey = unit === 'weekly' ? isoWeekKey(now) : unit === 'monthly' ? monthlyKey(now) : dailyKey(now);
    }
  }

  // Zentrale Entscheidung, ob ein Orts-/Zeitwechsel den Alarm ausloesen soll -
  // gemeinsam genutzt vom Vordergrund-Pfad (watchPosition, per Distanz) und
  // vom nativen Hintergrund-Pfad (echte Geofence-Transitions). Aktualisiert
  // loc.wasInside immer, damit beide Pfade sich nicht gegenseitig doppelt
  // ausloesen koennen (der zweite Aufruf sieht dann inside === wasInside).
  function applyLocationState(alarm, loc, inside, now) {
    var wasInside = !!loc.wasInside;
    if (inside === wasInside) return false;
    loc.wasInside = inside;

    if (!periodAllows(alarm, now) || !commuteAllows(alarm, now)) return false;

    var arrived = inside && !wasInside;
    var departed = !inside && wasInside;
    return (alarm.trigger === 'arrival' && arrived) || (alarm.trigger === 'departure' && departed);
  }

  function evaluate(position) {
    if (checking || !triggerCallback) return;
    checking = true;
    try {
      var lat = position.coords.latitude;
      var lng = position.coords.longitude;
      var now = new Date();
      var alarms = window.storage.locationAlarms.getAll();
      var changed = false;

      for (var i = 0; i < alarms.length; i++) {
        var alarm = alarms[i];
        if (!alarm.enabled || !alarm.locations || !alarm.locations.length) continue;

        var fired = false;
        var firedLocationId = null;
        var firedInside = null;

        alarm.locations.forEach(function (loc) {
          var distance = window.locationPicker.haversineMeters(lat, lng, loc.lat, loc.lng);
          var inside = distance <= (alarm.radius || 150);
          var wasInsideBefore = loc.wasInside;
          if (applyLocationState(alarm, loc, inside, now) && !fired) {
            fired = true;
            firedLocationId = loc.id;
            firedInside = inside;
          }
          if (loc.wasInside !== wasInsideBefore) changed = true;
        });

        if (fired) {
          markTriggered(alarm, now);
          changed = true;
          triggerCallback(alarm, firedLocationId, firedInside);
          break; // ein Alarm pro Positions-Update ist genug; changed=true speichert unten die ganze Liste
        }
      }

      if (changed) {
        window.storage.locationAlarms.save(alarms);
      }
    } finally {
      checking = false;
    }
  }

  function handlePosition(position) {
    evaluate(position);
  }

  // Wird von backgroundGeofence.js aufgerufen, wenn eine ECHTE native
  // Geofence-Transition eintrifft (auch wenn die App zuvor im Hintergrund
  // lief). isEnter=true/false statt Distanzberechnung, da Android/Play
  // Services das direkt liefern.
  function handleNativeTransition(alarmId, locationId, isEnter) {
    if (!triggerCallback) return;
    var alarms = window.storage.locationAlarms.getAll();
    var alarm = alarms.find(function (a) { return a.id === alarmId; });
    if (!alarm || !alarm.enabled || !alarm.locations) return;
    var loc = alarm.locations.find(function (l) { return l.id === locationId; });
    if (!loc) return;

    var now = new Date();
    var fired = applyLocationState(alarm, loc, isEnter, now);
    if (fired) markTriggered(alarm, now);

    window.storage.locationAlarms.save(alarms);
    if (fired) triggerCallback(alarm, locationId, isEnter);
  }

  function start() {
    if (watchHandle !== null) return;
    if (isNative()) {
      var plugin = geolocationPlugin();
      if (!plugin) return;
      plugin.watchPosition({ enableHighAccuracy: true, timeout: 15000 }, function (position, err) {
        if (err || !position) return;
        handlePosition(position);
      }).then(function (id) { watchHandle = id; });
    } else if (navigator.geolocation) {
      watchHandle = navigator.geolocation.watchPosition(
        handlePosition,
        function () { /* Position nicht verfügbar - stumm ignorieren */ },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    }
  }

  function stop() {
    if (watchHandle === null) return;
    if (isNative()) {
      var plugin = geolocationPlugin();
      if (plugin) plugin.clearWatch({ id: watchHandle });
    } else if (navigator.geolocation) {
      navigator.geolocation.clearWatch(watchHandle);
    }
    watchHandle = null;
  }

  var nativeTransitionsWired = false;

  function onTrigger(cb) {
    triggerCallback = cb;
    // Nativen Hintergrund-Pfad genau einmal verdrahten, sobald ein
    // Trigger-Callback registriert wurde (unabhängig vom Vordergrund-Watch).
    if (!nativeTransitionsWired && window.backgroundGeofence) {
      nativeTransitionsWired = true;
      window.backgroundGeofence.onTransition(handleNativeTransition);
    }
  }

  window.geoTrigger = {
    requestPermissions: requestPermissions,
    start: start,
    stop: stop,
    onTrigger: onTrigger,
    periodAllows: periodAllows,
    commuteAllows: commuteAllows
  };
})();
