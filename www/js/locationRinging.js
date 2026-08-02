(function () {
  'use strict';

  var overlay, adSpace, titleEl, descriptionEl, swipeTrack, swipeHandle, swipeHint;
  var activeAlarm = null;
  var onStopCallback = null;
  // true, wenn Ton/Vibration für die aktuell klingelnde Anzeige vom nativen
  // AlarmRingService übernommen werden (Alarm über den Vollbild-Intent-
  // Mechanismus ausgelöst) - dann darf alarmSound.js NICHT zusätzlich selbst
  // Ton/Vibration starten (Doppel-Ton) und stop() muss stattdessen den
  // nativen Dienst beenden.
  var nativeAudioActive = false;

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

  // Zeigt bei fehlender/fehlgeschlagener Anzeige eine neutrale, markenhafte
  // Fläche statt eines leeren/kaputt wirkenden Bereichs (z. B. keine
  // Internetverbindung unterwegs - typischer Fall bei einem Orts-Zeit-Wecker).
  function setAdFallback(active) {
    if (!adSpace) return;
    adSpace.textContent = active ? window.i18n.t('app.name') : '';
    adSpace.classList.toggle('is-fallback-brand', active);
  }

  function show(alarm, stopCallback, options) {
    activeAlarm = alarm;
    onStopCallback = stopCallback;
    nativeAudioActive = !!(options && options.nativeAudio);

    titleEl.textContent = alarm.title || window.i18n.t('alarm.defaultRingingTitle');
    descriptionEl.textContent = alarm.description || '';
    descriptionEl.hidden = !alarm.description;
    swipeHint.textContent = window.i18n.t('alarm.swipeToStop');
    resetSwipe();

    overlay.classList.add('is-visible');
    document.body.classList.add('is-ringing');

    // Läuft der native AlarmRingService bereits (Vollbild-Alarm-Pfad, siehe
    // locationAlarms.js), übernimmt der Ton/Vibration - die Web-Audio-
    // Umsetzung ist nur für den direkten Vordergrund-Pfad zuständig (App war
    // beim Auslösen bereits sichtbar geöffnet).
    if (!nativeAudioActive) window.alarmSound.start(alarm.sound || 'both');
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

  function stop() {
    if (nativeAudioActive) {
      window.locationAlarmBridge.stopAlarmSound();
    } else {
      window.alarmSound.stop();
    }
    nativeAudioActive = false;
    overlay.classList.remove('is-visible');
    document.body.classList.remove('is-ringing');
    window.ads.hideRingingBanner();
    setAdFallback(false);
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
      adSpace.textContent = window.i18n.t('ringing.adPlaceholder');
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
