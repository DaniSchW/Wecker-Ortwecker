(function () {
  'use strict';

  var overlay, adSpace, titleEl, descriptionEl, swipeTrack, swipeHandle, swipeHint;
  var activeAlarm = null;
  var onStopCallback = null;

  function resetSwipe() {
    swipeHandle.style.transform = 'translateX(0)';
    swipeHandle.classList.remove('is-dragging');
  }

  function setupSwipe() {
    var dragging = false;
    var startX = 0;
    var maxX = 0;

    function pointerDown(evt) {
      dragging = true;
      startX = (evt.touches ? evt.touches[0].clientX : evt.clientX);
      maxX = swipeTrack.clientWidth - swipeHandle.clientWidth - 8;
      swipeHandle.classList.add('is-dragging');
    }

    function pointerMove(evt) {
      if (!dragging) return;
      var x = (evt.touches ? evt.touches[0].clientX : evt.clientX);
      var delta = Math.min(Math.max(x - startX, 0), maxX);
      swipeHandle.style.transform = 'translateX(' + delta + 'px)';
      if (delta >= maxX * 0.92) {
        dragging = false;
        stop();
      }
    }

    function pointerUp() {
      if (!dragging) return;
      dragging = false;
      resetSwipe();
    }

    swipeHandle.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    swipeHandle.addEventListener('touchstart', pointerDown, { passive: true });
    window.addEventListener('touchmove', pointerMove, { passive: true });
    window.addEventListener('touchend', pointerUp);
  }

  function show(alarm, stopCallback) {
    activeAlarm = alarm;
    onStopCallback = stopCallback;

    titleEl.textContent = alarm.title || window.i18n.t('alarm.defaultRingingTitle');
    descriptionEl.textContent = alarm.description || '';
    descriptionEl.hidden = !alarm.description;
    swipeHint.textContent = window.i18n.t('alarm.swipeToStop');
    resetSwipe();

    overlay.classList.add('is-visible');
    document.body.classList.add('is-ringing');

    window.alarmSound.start(alarm.sound || 'both');
    // Native Anzeige liegt als eigenständige Systemansicht ÜBER der WebView
    // und wird nicht über adSpace ins DOM eingehängt - adSpace bleibt nur die
    // reservierte Freifläche (siehe CSS) plus Web-Vorschau-Platzhaltertext.
    window.ads.showLocationRingingBanner();
  }

  function stop() {
    window.alarmSound.stop();
    overlay.classList.remove('is-visible');
    document.body.classList.remove('is-ringing');
    window.ads.hideLocationRingingBanner();
    var alarm = activeAlarm;
    var cb = onStopCallback;
    activeAlarm = null;
    onStopCallback = null;
    if (cb) cb(alarm);
  }

  function init() {
    overlay = document.getElementById('location-ringing-overlay');
    adSpace = document.getElementById('location-ringing-ad');
    if (adSpace && !window.ads.isNative()) {
      adSpace.textContent = window.i18n.t('locationAlarm.adPlaceholder');
    }
    titleEl = document.getElementById('location-ringing-title');
    descriptionEl = document.getElementById('location-ringing-description');
    swipeTrack = document.getElementById('location-ringing-swipe-track');
    swipeHandle = document.getElementById('location-ringing-swipe-handle');
    swipeHint = document.getElementById('location-ringing-swipe-hint');
    setupSwipe();
  }

  window.locationRinging = { init: init, show: show, stop: stop };
})();
