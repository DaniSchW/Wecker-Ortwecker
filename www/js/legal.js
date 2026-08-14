(function () {
  'use strict';

  // Öffnet/schließt die Impressum- und Datenschutz-Modals (reiner Text,
  // siehe www/index.html #legal-impressum-modal/#legal-privacy-modal -
  // inhaltsgleich mit IMPRESSUM.md/PRIVACY.md im Repo-Root). Bewusst nur
  // In-App eingebunden (siehe Hinweis in PRIVACY.md zur zusätzlich nötigen
  // öffentlichen Datenschutz-URL für die Play Console).

  function open(modal) {
    modal.classList.add('is-visible');
  }

  function close(modal) {
    modal.classList.remove('is-visible');
  }

  function init() {
    var impressumModal = document.getElementById('legal-impressum-modal');
    var privacyModal = document.getElementById('legal-privacy-modal');
    var impressumBtn = document.getElementById('settings-impressum-btn');
    var privacyBtn = document.getElementById('settings-privacy-btn');
    var impressumCloseBtn = document.getElementById('legal-impressum-close-btn');
    var privacyCloseBtn = document.getElementById('legal-privacy-close-btn');
    if (!impressumModal || !privacyModal) return;

    impressumBtn.addEventListener('click', function () { open(impressumModal); });
    privacyBtn.addEventListener('click', function () { open(privacyModal); });
    impressumCloseBtn.addEventListener('click', function () { close(impressumModal); });
    privacyCloseBtn.addEventListener('click', function () { close(privacyModal); });
    impressumModal.querySelector('.modal-backdrop').addEventListener('click', function () { close(impressumModal); });
    privacyModal.querySelector('.modal-backdrop').addEventListener('click', function () { close(privacyModal); });
  }

  window.legal = { init: init };
})();
