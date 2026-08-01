(function () {
  'use strict';

  function activateTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(function (panel) {
      panel.classList.toggle('is-active', panel.id === 'tab-' + tabId);
    });
    document.querySelectorAll('.nav-item').forEach(function (btn) {
      var isActive = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
  }

  function init() {
    var navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activateTab(btn.getAttribute('data-tab'));
      });
    });
  }

  window.tabs = { init: init, activate: activateTab };
})();
