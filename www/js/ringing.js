(function () {
  'use strict';

  var overlay, titleEl, timeEl, swipeTrack, swipeHandle, swipeHint, snoozeBtn;
  var activeAlarm = null;
  var onStopCallback = null;
  var onSnoozeCallback = null;

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
  }

  function close() {
    window.alarmSound.stop();
    overlay.classList.remove('is-visible');
    document.body.classList.remove('is-ringing');
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
