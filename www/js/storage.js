(function () {
  'use strict';

  var KEYS = {
    alarms: 'wo.alarms',
    timers: 'wo.timers',
    locationAlarms: 'wo.locationAlarms',
    tabataPresets: 'wo.tabataPresets',
    ringSettings: 'wo.ringSettings'
  };

  function readList(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('storage: konnte "' + key + '" nicht lesen', e);
      return [];
    }
  }

  function writeList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.error('storage: konnte "' + key + '" nicht schreiben', e);
    }
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function makeStore(key) {
    return {
      getAll: function () {
        return readList(key);
      },
      save: function (list) {
        writeList(key, list);
      },
      upsert: function (item) {
        var list = readList(key);
        var idx = list.findIndex(function (entry) {
          return entry.id === item.id;
        });
        if (idx === -1) {
          list.push(item);
        } else {
          list[idx] = item;
        }
        writeList(key, list);
        return list;
      },
      remove: function (id) {
        var list = readList(key).filter(function (entry) {
          return entry.id !== id;
        });
        writeList(key, list);
        return list;
      }
    };
  }

  // Einzelnes Einstellungsobjekt (kein Store fuer Listen-Items) fuer die
  // globalen Standardwerte des Dauerklingel-Verhaltens (siehe ringSettings.js).
  function readObject(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('storage: konnte "' + key + '" nicht lesen', e);
      return {};
    }
  }

  function writeObject(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj || {}));
    } catch (e) {
      console.error('storage: konnte "' + key + '" nicht schreiben', e);
    }
  }

  window.storage = {
    makeId: makeId,
    alarms: makeStore(KEYS.alarms),
    timers: makeStore(KEYS.timers),
    locationAlarms: makeStore(KEYS.locationAlarms),
    tabataPresets: makeStore(KEYS.tabataPresets),
    ringSettings: {
      get: function () { return readObject(KEYS.ringSettings); },
      save: function (obj) { writeObject(KEYS.ringSettings, obj); }
    }
  };
})();
