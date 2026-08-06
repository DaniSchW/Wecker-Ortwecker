(function () {
  'use strict';

  var overlay, adSpace, titleEl, timeEl, swipeTrack, swipeHandle, swipeHint, snoozeBtn;
  var activeAlarm = null;
  var onStopCallback = null;
  var onSnoozeCallback = null;
  // true, wenn Ton/Vibration für die aktuell klingelnde Anzeige vom nativen
  // AlarmRingService übernommen werden (Vollbild-Alarm-Mechanismus) - dann
  // darf alarmSound.js NICHT zusätzlich selbst Ton/Vibration starten
  // (Doppel-Ton), und stop()/snooze() müssen stattdessen den nativen Dienst
  // beenden (der sonst eigenständig über mehrere Klingel-Zyklen weiterliefe).
  var nativeAudioActive = false;

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

  function show(alarm, stopCallback, snoozeCallback, options) {
    activeAlarm = alarm;
    onStopCallback = stopCallback;
    onSnoozeCallback = alarm.snoozeEnabled !== false ? snoozeCallback : null;
    nativeAudioActive = !!(options && options.nativeAudio);

    titleEl.textContent = alarm.label && alarm.label.trim() ? alarm.label : window.i18n.t('alarm.defaultRingingTitle');
    timeEl.textContent = alarm.time || formatNow();
    swipeHint.textContent = window.i18n.t('alarm.swipeToStop');
    snoozeBtn.hidden = !onSnoozeCallback;
    resetSwipe();

    overlay.classList.add('is-visible');
    document.body.classList.add('is-ringing');

    // Läuft der native AlarmRingService bereits (Vollbild-Alarm-Pfad),
    // übernimmt der Ton/Vibration inkl. Klingel-Pause-Zyklen - die
    // Web-Audio-Umsetzung ist nur der Fallback für die Browser-Vorschau.
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

  function close() {
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

  // Schließt das Overlay OHNE stop-Callback auszulösen, sofern es gerade
  // für genau diesen Alarm sichtbar ist - aufgerufen, wenn AlarmRingService
  // alle Klingel-Zyklen ohne Nutzer-Interaktion durchlaufen hat (der native
  // Dienst hat sich in diesem Fall bereits selbst beendet, stopAlarmSound()
  // ist also nur noch ein harmloses No-Op).
  function closeIfActive(alarmId) {
    if (!activeAlarm || activeAlarm.id !== alarmId) return;
    close();
    activeAlarm = null;
    onStopCallback = null;
    onSnoozeCallback = null;
  }

  // Zeigt bereits das Overlay fuer genau diesen Alarm - relevant, damit ein
  // erneuter Vollbild-Intent bei Wiederaufnahme nach einer Klingel-Pause
  // (siehe AlarmRingService) nicht bei jedem Zyklus erneut show() aufruft.
  function isActive(alarmId) {
    return !!(activeAlarm && activeAlarm.id === alarmId);
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

  window.ringing = { init: init, show: show, stop: stop, closeIfActive: closeIfActive, isActive: isActive };
})();
