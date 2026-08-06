(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    window.i18n.init()
      .catch(function (err) {
        console.error(err);
      })
      .then(function () {
        window.tabs.init();
        window.ringing.init();
        window.locationRinging.init();
        window.alarmsTab.init();
        window.stopwatchTab.init();
        window.timerTab.init();
        window.tabataTab.init();
        window.locationAlarmsTab.init();
        window.ringSettings.init();
        window.settingsData.init();

        // Zentrale Verteilung eines ueber einen Vollbild-Intent
        // ausgeloesten Alarms an das passende Tab-Modul (anhand
        // pending.kind) - MUSS an genau dieser einen Stelle passieren, da
        // consumePendingAlarm() ein einmalig konsumierbarer nativer Aufruf
        // ist (siehe MainActivity.consumePendingAlarm()); wuerde sowohl
        // alarms.js als auch locationAlarms.js ihn selbst aufrufen, bekaeme
        // nur eines der beiden Module die Daten.
        function dispatchPendingAlarm(pending) {
          if (!pending) return;
          if (pending.kind === 'standard') {
            window.alarmsTab.ringFromNativePending(pending);
          } else {
            window.locationAlarmsTab.ringFromNativePending(pending);
          }
        }
        window.locationAlarmBridge.consumePendingAlarm().then(dispatchPendingAlarm);
        window.locationAlarmBridge.onPendingAlarm(dispatchPendingAlarm);

        // Schließt ein noch offenes Overlay automatisch, wenn
        // AlarmRingService alle Klingel-Zyklen ohne Nutzer-Interaktion
        // durchlaufen hat (siehe AlarmRingService.finishSession()).
        window.locationAlarmBridge.onAlarmExpired(function (data) {
          if (data.kind === 'standard') {
            window.ringing.closeIfActive(data.alarmId);
          } else {
            window.locationRinging.closeIfActive(data.alarmId);
          }
        });

        window.Notify.createChannels();
        window.Notify.requestPermissions();
        window.ads.init();
      });
  });
})();
