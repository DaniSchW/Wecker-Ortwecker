(function () {
  'use strict';

  var overlay, titleEl, timeEl, swipeTrack, swipeHandle, swipeHint;
  var audioCtx = null;
  var oscillators = [];
  var vibrateIntervalId = null;
  var activeAlarm = null;
  var onStopCallback = null;

  function beepLoopStart() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      playBeepCycle();
    } catch (e) {
      console.error('ringing: Audio nicht verfügbar', e);
    }
  }

  function playBeepCycle() {
    if (!audioCtx) return;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    var now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.4);
    oscillators.push(osc);

    osc.onended = function () {
      oscillators = oscillators.filter(function (o) { return o !== osc; });
    };
  }

  var beepIntervalId = null;

  function startSound() {
    beepLoopStart();
    beepIntervalId = setInterval(playBeepCycle, 700);
  }

  function stopSound() {
    if (beepIntervalId) {
      clearInterval(beepIntervalId);
      beepIntervalId = null;
    }
    oscillators.forEach(function (o) {
      try { o.stop(); } catch (e) { /* bereits gestoppt */ }
    });
    oscillators = [];
  }

  function vibratePulse() {
    var haptics = window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.Haptics : null;
    if (haptics && haptics.vibrate) {
      haptics.vibrate({ duration: 400 }).catch(function () {});
    } else if (navigator.vibrate) {
      navigator.vibrate(400);
    }
  }

  function startVibration() {
    vibratePulse();
    vibrateIntervalId = setInterval(vibratePulse, 900);
  }

  function stopVibration() {
    if (vibrateIntervalId) {
      clearInterval(vibrateIntervalId);
      vibrateIntervalId = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
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

  function show(alarm, stopCallback) {
    activeAlarm = alarm;
    onStopCallback = stopCallback;

    titleEl.textContent = alarm.label && alarm.label.trim() ? alarm.label : window.i18n.t('alarm.defaultRingingTitle');
    timeEl.textContent = alarm.time || formatNow();
    swipeHint.textContent = window.i18n.t('alarm.swipeToStop');
    resetSwipe();

    overlay.classList.add('is-visible');
    document.body.classList.add('is-ringing');

    var mode = alarm.sound || 'both';
    if (mode === 'sound' || mode === 'both') startSound();
    if (mode === 'vibration' || mode === 'both') startVibration();
  }

  function stop() {
    stopSound();
    stopVibration();
    overlay.classList.remove('is-visible');
    document.body.classList.remove('is-ringing');
    var alarm = activeAlarm;
    var cb = onStopCallback;
    activeAlarm = null;
    onStopCallback = null;
    if (cb) cb(alarm);
  }

  function init() {
    overlay = document.getElementById('ringing-overlay');
    titleEl = document.getElementById('ringing-title');
    timeEl = document.getElementById('ringing-time');
    swipeTrack = document.getElementById('ringing-swipe-track');
    swipeHandle = document.getElementById('ringing-swipe-handle');
    swipeHint = document.getElementById('ringing-swipe-hint');
    setupSwipe();
  }

  window.ringing = { init: init, show: show, stop: stop };
})();
