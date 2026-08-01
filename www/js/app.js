(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    window.i18n.init().catch(function (err) {
      console.error(err);
    });
    window.tabs.init();
  });
})();
