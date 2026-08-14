(function () {
  'use strict';

  // Verdrahtet den "Pro-Version"-Abschnitt im Einstellungen-Modal
  // (www/index.html) mit dem Billing-Bridge-Wrapper (www/js/billing.js).
  // Kauf/Verwaltung selbst laufen vollständig über Google Play - dieses
  // Modul zeigt nur den aktuellen Status an und leitet Klicks weiter.

  var statusEl, buyBtn, manageBtn, errorEl;

  function render() {
    var active = window.billing.isPro();
    statusEl.textContent = window.i18n.t(active ? 'settings.proStatusActive' : 'settings.proStatusFree');
    buyBtn.hidden = active;
    manageBtn.hidden = !active;
  }

  function setError(text) {
    errorEl.textContent = text || '';
    errorEl.hidden = !text;
  }

  function handleBuy() {
    setError('');
    window.billing.purchase().catch(function (err) {
      console.error('settingsPro: Kauf fehlgeschlagen', err);
      setError(window.i18n.t('settings.proBuyError'));
    });
  }

  function handleManage() {
    window.billing.openManageSubscription();
  }

  function init() {
    statusEl = document.getElementById('settings-pro-status');
    buyBtn = document.getElementById('settings-pro-buy-btn');
    manageBtn = document.getElementById('settings-pro-manage-btn');
    errorEl = document.getElementById('settings-pro-error');
    if (!statusEl || !buyBtn || !manageBtn) return;

    render();
    window.billing.onStatusChange(render);
    buyBtn.addEventListener('click', handleBuy);
    manageBtn.addEventListener('click', handleManage);
  }

  window.settingsPro = { init: init };
})();
