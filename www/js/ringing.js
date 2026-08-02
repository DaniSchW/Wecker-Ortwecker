(function () {
  'use strict';

  var overlay, adSpace, titleEl, timeEl, swipeTrack, swipeHandle, swipeHint, snoozeBtn;
  var activeAlarm = null;
  var onStopCallback = null;
  var onSnoozeCallback = null;

  // Neutrale Marken-Fläche statt eines leeren/kaputt wirkenden Bereichs, wenn
  // keine Anzeige geladen werden konnte (analog locationRinging.js).
  function setAdFallback(active) {
    if (!adSpace) return;
    adSpace.textContent = active ? window.i18n.t('app.name') : '';
    adSpace.classList.toggle('is-fallback-brand', active);
  }

  function formatNow() {
    var d = new Date();
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }

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

  function show(alarm, stopCallback, snoozeCallback) {
    activeAlarm = alarm;
    onStopCallback = stopCallback;
    onSnoozeCallback = alarm.snoozeEnabled !== false ? snoozeCallback : null;

    titleEl.textContent = alarm.label && alarm.label.trim() ? alarm.label : window.i18n.t('alarm.defaultRingingTitle');
    timeEl.textContent = alarm.time || formatNow();
    swipeHint.textContent = window.i18n.t('alarm.swipeToStop');
    snoozeBtn.hidden = !onSnoozeCallback;
    resetSwipe();

    overlay.classList.add('is-visible');
    document.body.classList.add('is-ringing');

    window.alarmSound.start(alarm.sound || 'both');
    if (window.ads.isNative()) {
      // Native Anzeige liegt als eigenständige Systemansicht ÜBER der
      // WebView und wird nicht über adSpace ins DOM eingehängt - adSpace
      // bleibt nur die reservierte Freifläche (siehe CSS) und zeigt die
      // Fallback-Fläche, falls keine Anzeige geladen werden konnte.
      setAdFallback(false);
      window.ads.showRingingBanner().then(function (shown) {
        // Nur noch relevant, wenn der Bildschirm nicht laengst wieder
        // geschlossen wurde (sehr schnelles Wegwischen).
        if (overlay.classList.contains('is-visible')) setAdFallback(!shown);
      });
    }
  }

  function close() {
    window.alarmSound.stop();
    overlay.classList.remove('is-visible');
    document.body.classList.remove('is-ringing');
    window.ads.hideRingingBanner();
    setAdFallback(false);
  }

  function stop() {
    close();
    var alarm = activeAlarm;
    var cb = onStopCallback;
    activeAlarm = null;
    onStopCallback = null;
    onSnoozeCallback = null;
    if (cb) cb(alarm);
  }

  function snooze() {
    if (!onSnoozeCallback) return;
    close();
    var alarm = activeAlarm;
    var cb = onSnoozeCallback;
    activeAlarm = null;
    onStopCallback = null;
    onSnoozeCallback = null;
    cb(alarm);
  }

  function init() {
    overlay = document.getElementById('ringing-overlay');
    adSpace = document.getElementById('ringing-ad');
    if (adSpace && !window.ads.isNative()) {
      adSpace.textContent = window.i18n.t('ringing.adPlaceholder');
    }
    titleEl = document.getElementById('ringing-title');
    timeEl = document.getElementById('ringing-time');
    swipeTrack = document.getElementById('ringing-swipe-track');
    swipeHandle = document.getElementById('ringing-swipe-handle');
    swipeHint = document.getElementById('ringing-swipe-hint');
    snoozeBtn = document.getElementById('ringing-snooze-btn');
    snoozeBtn.addEventListener('click', snooze);
    setupSwipe();
  }

  window.ringing = { init: init, show: show, stop: stop };
})();
