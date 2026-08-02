(function () {
  'use strict';

  var EXPORT_APP_ID = 'wecker-ortswecker';
  var EXPORT_VERSION = 1;

  var settingsModal, openBtn, closeBtn, exportBtn, importBtn, importFileInput, statusEl;

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform());
  }

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.classList.toggle('is-error', !!isError);
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function fileNameFor(date) {
    return 'wecker-ortswecker-backup-' + date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) +
      '-' + pad(date.getHours()) + pad(date.getMinutes()) + '.json';
  }

  function buildExportPayload() {
    return {
      app: EXPORT_APP_ID,
      exportVersion: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      alarms: window.storage.alarms.getAll(),
      locationAlarms: window.storage.locationAlarms.getAll()
    };
  }

  function exportNative(json, fileName) {
    var Filesystem = window.Capacitor.Plugins.Filesystem;
    var Share = window.Capacitor.Plugins.Share;
    return Filesystem.writeFile({
      path: fileName,
      data: json,
      directory: 'CACHE',
      encoding: 'utf8'
    }).then(function (result) {
      return Share.share({
        title: window.i18n.t('settings.exportShareTitle'),
        files: [result.uri],
        dialogTitle: window.i18n.t('settings.exportShareTitle')
      });
    });
  }

  function exportWeb(json, fileName) {
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return Promise.resolve();
  }

  function exportAlarms() {
    var payload = buildExportPayload();
    var json = JSON.stringify(payload, null, 2);
    var fileName = fileNameFor(new Date());
    var count = payload.alarms.length + payload.locationAlarms.length;
    var task = isNative() ? exportNative(json, fileName) : exportWeb(json, fileName);

    return task.then(function () {
      setStatus(window.i18n.t('settings.exportSuccess').replace('{count}', count), false);
    }).catch(function (err) {
      console.error('settingsData: Export fehlgeschlagen', err);
      setStatus(window.i18n.t('settings.exportError'), true);
    });
  }

  function decodeBase64Utf8(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function importNative() {
    var FilePicker = window.Capacitor.Plugins.FilePicker;
    return FilePicker.pickFiles({ types: ['application/json'], limit: 1, readData: true }).then(function (result) {
      var file = result && result.files && result.files[0];
      if (!file || !file.data) {
        var err = new Error('cancelled');
        throw err;
      }
      return decodeBase64Utf8(file.data);
    });
  }

  function importWeb() {
    return new Promise(function (resolve, reject) {
      importFileInput.value = '';
      importFileInput.onchange = function () {
        var file = importFileInput.files && importFileInput.files[0];
        if (!file) {
          reject(new Error('cancelled'));
          return;
        }
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result)); };
        reader.onerror = function () { reject(reader.error || new Error('read-error')); };
        reader.readAsText(file);
      };
      importFileInput.click();
    });
  }

  function validatePayload(payload) {
    return !!payload && payload.app === EXPORT_APP_ID &&
      Array.isArray(payload.alarms) && Array.isArray(payload.locationAlarms);
  }

  function mergeList(store, items) {
    var count = 0;
    items.forEach(function (item) {
      if (!item || !item.id) return;
      store.upsert(item);
      count++;
    });
    return count;
  }

  function importAlarms() {
    var task = isNative() ? importNative() : importWeb();

    return task.then(function (text) {
      var payload;
      try {
        payload = JSON.parse(text);
      } catch (e) {
        throw new Error('invalid-format');
      }
      if (!validatePayload(payload)) throw new Error('invalid-format');

      var alarmCount = mergeList(window.storage.alarms, payload.alarms);
      var locationCount = mergeList(window.storage.locationAlarms, payload.locationAlarms);

      window.alarmsTab.rescheduleAll();
      window.locationAlarmsTab.resyncAll();

      setStatus(window.i18n.t('settings.importSuccess').replace('{count}', alarmCount + locationCount), false);
    }).catch(function (err) {
      if (err && err.message === 'cancelled') return;
      console.error('settingsData: Import fehlgeschlagen', err);
      var key = err && err.message === 'invalid-format' ? 'settings.importInvalidFile' : 'settings.importError';
      setStatus(window.i18n.t(key), true);
    });
  }

  function openModal() {
    setStatus('', false);
    settingsModal.classList.add('is-visible');
  }

  function closeModal() {
    settingsModal.classList.remove('is-visible');
  }

  function init() {
    settingsModal = document.getElementById('settings-modal');
    openBtn = document.getElementById('settings-open-btn');
    closeBtn = document.getElementById('settings-close-btn');
    exportBtn = document.getElementById('settings-export-btn');
    importBtn = document.getElementById('settings-import-btn');
    importFileInput = document.getElementById('settings-import-file-input');
    statusEl = document.getElementById('settings-data-status');

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    settingsModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    exportBtn.addEventListener('click', exportAlarms);
    importBtn.addEventListener('click', importAlarms);
  }

  window.settingsData = { init: init, exportAlarms: exportAlarms, importAlarms: importAlarms };
})();
