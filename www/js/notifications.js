(function () {
  'use strict';

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function nativePlugin(name) {
    return window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null;
  }

  // In-browser fallback (kein Capacitor-Bridge vorhanden): simuliert Scheduling
  // per setTimeout, solange die Seite geöffnet ist. Dient nur der Vorschau/dem
  // Testen der UI, ersetzt kein natives Scheduling im Hintergrund.
  var fallbackTimers = {};
  var fallbackListeners = [];

  function fallbackTargetDate(schedule) {
    if (schedule.at) {
      return new Date(schedule.at);
    }
    if (schedule.on) {
      var hh = String(schedule.on.hour).padStart(2, '0');
      var mm = String(schedule.on.minute).padStart(2, '0');
      var jsWeekday = schedule.on.weekday === undefined ? null : schedule.on.weekday - 1;
      return nextOccurrence(hh + ':' + mm, jsWeekday);
    }
    return new Date();
  }

  function fallbackSchedule(notifications) {
    notifications.forEach(function (n) {
      var target = fallbackTargetDate(n.schedule);
      var delay = Math.max(0, target.getTime() - Date.now());
      clearTimeout(fallbackTimers[n.id]);
      fallbackTimers[n.id] = setTimeout(function () {
        fallbackListeners.forEach(function (cb) {
          cb({ notification: n });
        });
      }, delay);
    });
    return Promise.resolve();
  }

  function fallbackCancel(ids) {
    ids.forEach(function (id) {
      clearTimeout(fallbackTimers[id]);
      delete fallbackTimers[id];
    });
    return Promise.resolve();
  }

  var counterKey = 'wo.notificationIdCounter';

  function nextId() {
    var n = parseInt(localStorage.getItem(counterKey) || '1000', 10) + 1;
    localStorage.setItem(counterKey, String(n));
    return n;
  }

  function requestPermissions() {
    if (!isNative()) return Promise.resolve(true);
    var plugin = nativePlugin('LocalNotifications');
    if (!plugin) return Promise.resolve(false);
    return plugin.requestPermissions().then(function (res) {
      return res && res.display === 'granted';
    });
  }

  function schedule(notifications) {
    if (isNative()) {
      var plugin = nativePlugin('LocalNotifications');
      if (!plugin) return Promise.resolve();
      return plugin.schedule({ notifications: notifications });
    }
    return fallbackSchedule(notifications);
  }

  function cancel(ids) {
    if (!ids || !ids.length) return Promise.resolve();
    if (isNative()) {
      var plugin = nativePlugin('LocalNotifications');
      if (!plugin) return Promise.resolve();
      return plugin.cancel({ notifications: ids.map(function (id) { return { id: id }; }) });
    }
    return fallbackCancel(ids);
  }

  function onFire(callback) {
    if (isNative()) {
      var plugin = nativePlugin('LocalNotifications');
      if (plugin) {
        plugin.addListener('localNotificationReceived', callback);
        plugin.addListener('localNotificationActionPerformed', function (evt) {
          callback({ notification: evt.notification });
        });
      }
    } else {
      fallbackListeners.push(callback);
    }
  }

  // Wochentag-Konvertierung: JS Date.getDay() (0=So..6=Sa) -> Capacitor
  // Weekday (1=So..7=Sa, wie java.util.Calendar).
  function toCapacitorWeekday(jsDay) {
    return jsDay + 1;
  }

  function channelFor(sound) {
    switch (sound) {
      case 'silent':
      case 'vibration':
        return 'alarm_vibration';
      case 'sound':
        return 'alarm_sound';
      default:
        return 'alarm_both';
    }
  }

  function createChannels() {
    if (!isNative()) return Promise.resolve();
    var plugin = nativePlugin('LocalNotifications');
    if (!plugin || !plugin.createChannel) return Promise.resolve();
    var channels = [
      { id: 'alarm_both', name: 'Wecker (Ton & Vibration)', importance: 5, visibility: 1, vibration: true, sound: 'alarm_default' },
      { id: 'alarm_sound', name: 'Wecker (nur Ton)', importance: 5, visibility: 1, vibration: false, sound: 'alarm_default' },
      { id: 'alarm_vibration', name: 'Wecker (nur Vibration)', importance: 5, visibility: 1, vibration: true }
    ];
    return Promise.all(channels.map(function (c) {
      return plugin.createChannel(c).catch(function () {});
    }));
  }

  function nextOccurrence(time, weekday) {
    var parts = time.split(':');
    var hour = parseInt(parts[0], 10);
    var minute = parseInt(parts[1], 10);
    var now = new Date();
    var candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);

    if (weekday === null || weekday === undefined) {
      if (candidate.getTime() <= now.getTime()) {
        candidate.setDate(candidate.getDate() + 1);
      }
      return candidate;
    }

    var diff = (weekday - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + diff);
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 7);
    }
    return candidate;
  }

  window.Notify = {
    isNative: isNative,
    requestPermissions: requestPermissions,
    createChannels: createChannels,
    schedule: schedule,
    cancel: cancel,
    onFire: onFire,
    nextId: nextId,
    toCapacitorWeekday: toCapacitorWeekday,
    channelFor: channelFor,
    nextOccurrence: nextOccurrence
  };
})();
