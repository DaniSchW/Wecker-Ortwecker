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
        window.settingsData.init();

        window.Notify.createChannels();
        window.Notify.requestPermissions();
        window.ads.init();
      });
  });
})();
