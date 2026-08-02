(function () {
  'use strict';

  var stack, modal, form, labelInput, hoursInput, minutesInput, secondsInput;
  var timers = [];
  var tickIntervalId = null;
  var chimeIntervalId = null;
  var audioCtx = null;

  function persist() {
    window.storage.timers.save(timers);
  }

  function formatRemaining(ms) {
    var totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    if (hours > 0) {
      return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }
    return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }

  function remainingOf(timer) {
    if (timer.state === 'running') {
      return Math.max(0, timer.endAt - Date.now());
    }
    return timer.remainingMs;
  }

  function render() {
    stack.querySelectorAll('.tile:not(.tile-add)').forEach(function (el) { el.remove(); });
    stack.querySelectorAll('.empty-state').forEach(function (el) { el.remove(); });

    if (!timers.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.setAttribute('data-i18n', 'timer.empty');
      empty.textContent = window.i18n.t('timer.empty');
      stack.insertBefore(empty, stack.firstChild);
      return;
    }

    timers.forEach(function (timer) {
      var remaining = remainingOf(timer);
      var progress = timer.durationMs > 0 ? 1 - remaining / timer.durationMs : 0;

      var tile = document.createElement('div');
      tile.className = 'tile timer-tile' + (timer.state === 'done' ? ' is-done' : '');
      tile.setAttribute('data-id', timer.id);
      tile.innerHTML =
        '<div class="timer-tile-top">' +
          '<span class="timer-tile-label">' + escapeHtml(timer.label || window.i18n.t('timer.defaultLabel')) + '</span>' +
          '<button type="button" class="icon-btn timer-delete" data-i18n-aria-label="timer.delete" aria-label="' + window.i18n.t('timer.delete') + '">✕</button>' +
        '</div>' +
        '<div class="timer-tile-time">' + (timer.state === 'done' ? window.i18n.t('timer.done') : formatRemaining(remaining)) + '</div>' +
        '<div class="progress-bar"><div class="progress-bar-fill" style="width:' + Math.min(100, Math.max(0, progress * 100)) + '%"></div></div>' +
        '<div class="timer-tile-controls tile-actions">' +
          (timer.state === 'done'
            ? '<button type="button" class="btn timer-ack">' + window.i18n.t('timer.ack') + '</button>'
            : '<button type="button" class="btn timer-toggle">' + window.i18n.t(timer.state === 'running' ? 'timer.pause' : 'timer.start') + '</button>' +
              '<button type="button" class="btn secondary timer-reset">' + window.i18n.t('timer.reset') + '</button>') +
        '</div>';

      tile.querySelector('.timer-delete').addEventListener('click', function () { removeTimer(timer.id); });
      var toggleBtn = tile.querySelector('.timer-toggle');
      if (toggleBtn) toggleBtn.addEventListener('click', function () { toggleTimer(timer.id); });
      var resetBtn = tile.querySelector('.timer-reset');
      if (resetBtn) resetBtn.addEventListener('click', function () { resetTimer(timer.id); });
      var ackBtn = tile.querySelector('.timer-ack');
      if (ackBtn) ackBtn.addEventListener('click', function () { acknowledgeTimer(timer.id); });

      stack.insertBefore(tile, stack.querySelector('.tile-add'));
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function toggleTimer(id) {
    var timer = timers.find(function (t) { return t.id === id; });
    if (!timer) return;
    if (timer.state === 'running') {
      timer.remainingMs = remainingOf(timer);
      timer.state = 'paused';
      timer.endAt = null;
      window.Notify.cancel(timer.notificationId ? [timer.notificationId] : []);
      timer.notificationId = null;
    } else {
      timer.endAt = Date.now() + timer.remainingMs;
      timer.state = 'running';
      scheduleTimerNotification(timer);
    }
    persist();
    render();
    ensureTicking();
  }

  function resetTimer(id) {
    var timer = timers.find(function (t) { return t.id === id; });
    if (!timer) return;
    window.Notify.cancel(timer.notificationId ? [timer.notificationId] : []);
    timer.notificationId = null;
    timer.state = 'idle';
    timer.endAt = null;
    timer.remainingMs = timer.durationMs;
    persist();
    render();
  }

  function acknowledgeTimer(id) {
    resetTimer(id);
    updateChimeState();
  }

  function removeTimer(id) {
    var timer = timers.find(function (t) { return t.id === id; });
    if (timer) window.Notify.cancel(timer.notificationId ? [timer.notificationId] : []);
    timers = timers.filter(function (t) { return t.id !== id; });
    persist();
    render();
    updateChimeState();
  }

  function scheduleTimerNotification(timer) {
    var id = window.Notify.nextId();
    timer.notificationId = id;
    window.Notify.schedule([{
      id: id,
      title: timer.label || window.i18n.t('timer.defaultLabel'),
      body: window.i18n.t('timer.done'),
      channelId: 'alarm_both',
      schedule: { at: new Date(timer.endAt) },
      extra: { type: 'timer', timerId: timer.id }
    }]);
  }

  function finishTimer(timer) {
    timer.state = 'done';
    timer.remainingMs = 0;
    timer.endAt = null;
    persist();
  }

  function ensureTicking() {
    if (tickIntervalId) return;
    tickIntervalId = setInterval(function () {
      var changed = false;
      timers.forEach(function (timer) {
        if (timer.state === 'running' && remainingOf(timer) <= 0) {
          finishTimer(timer);
          changed = true;
        }
      });
      if (changed) updateChimeState();
      render();
      if (!timers.some(function (t) { return t.state === 'running'; })) {
        clearInterval(tickIntervalId);
        tickIntervalId = null;
      }
    }, 250);
  }

  function playChimeCycle() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      var now = audioCtx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.55);
    } catch (e) {
      console.error('timer: Ton nicht verfügbar', e);
    }
    var haptics = window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.Haptics : null;
    if (haptics && haptics.vibrate) {
      haptics.vibrate({ duration: 250 }).catch(function () {});
    } else if (navigator.vibrate) {
      navigator.vibrate(250);
    }
  }

  function updateChimeState() {
    var anyDone = timers.some(function (t) { return t.state === 'done'; });
    if (anyDone && !chimeIntervalId) {
      playChimeCycle();
      chimeIntervalId = setInterval(playChimeCycle, 1200);
    } else if (!anyDone && chimeIntervalId) {
      clearInterval(chimeIntervalId);
      chimeIntervalId = null;
    }
  }

  function openModal() {
    labelInput.value = '';
    hoursInput.value = 0;
    minutesInput.value = 5;
    secondsInput.value = 0;
    modal.classList.add('is-visible');
  }

  function closeModal() {
    modal.classList.remove('is-visible');
  }

  function saveForm(evt) {
    evt.preventDefault();
    var h = parseInt(hoursInput.value, 10) || 0;
    var m = parseInt(minutesInput.value, 10) || 0;
    var s = parseInt(secondsInput.value, 10) || 0;
    var durationMs = ((h * 60 + m) * 60 + s) * 1000;
    if (durationMs <= 0) return;

    timers.push({
      id: window.storage.makeId(),
      label: labelInput.value.trim(),
      durationMs: durationMs,
      remainingMs: durationMs,
      endAt: null,
      state: 'idle',
      notificationId: null
    });
    persist();
    closeModal();
    render();
  }

  function handleFire(evt) {
    var extra = evt.notification && evt.notification.extra;
    if (!extra || extra.type !== 'timer') return;
    var timer = timers.find(function (t) { return t.id === extra.timerId; });
    if (!timer || timer.state === 'done') return;
    finishTimer(timer);
    updateChimeState();
    render();
  }

  function init() {
    stack = document.querySelector('#tab-timer .tile-stack');
    modal = document.getElementById('timer-modal');
    form = document.getElementById('timer-form');
    labelInput = document.getElementById('timer-label');
    hoursInput = document.getElementById('timer-hours');
    minutesInput = document.getElementById('timer-minutes');
    secondsInput = document.getElementById('timer-seconds');

    timers = window.storage.timers.getAll();
    var needsPersist = false;
    timers.forEach(function (timer) {
      if (timer.state === 'running' && remainingOf(timer) <= 0) {
        finishTimer(timer);
        needsPersist = true;
      }
    });
    if (needsPersist) persist();

    stack.querySelector('.tile-add').addEventListener('click', openModal);
    document.getElementById('timer-cancel').addEventListener('click', closeModal);
    modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    form.addEventListener('submit', saveForm);

    window.Notify.onFire(handleFire);

    render();
    updateChimeState();
    if (timers.some(function (t) { return t.state === 'running'; })) ensureTicking();
  }

  window.timerTab = { init: init };
})();
