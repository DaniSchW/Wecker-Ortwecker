(function () {
  'use strict';

  var audioCtx = null;
  var oscillators = [];
  var beepIntervalId = null;
  var vibrateIntervalId = null;

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

  function startSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      playBeepCycle();
    } catch (e) {
      console.error('alarmSound: Audio nicht verfügbar', e);
    }
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

  function start(mode) {
    var m = mode || 'both';
    if (m === 'sound' || m === 'both') startSound();
    if (m === 'vibration' || m === 'both') startVibration();
  }

  function stop() {
    stopSound();
    stopVibration();
  }

  window.alarmSound = { start: start, stop: stop };
})();
