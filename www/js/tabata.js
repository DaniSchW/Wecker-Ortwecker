(function () {
  'use strict';

  var listStack, sessionView, modeSwitchButtons, modePanels;
  var modal, form, modalTitle, labelInput, workInput, restInput, roundsInput, prepEnabledInput, prepWrap, prepInput;
  var sessionLabelEl, phaseLabelEl, timeEl, roundProgressEl, startPauseBtn, resetBtn, backBtn;

  var editingId = null;
  var presets = [];

  var session = null; // { preset, phase, round, endAt, remainingSec, running }
  var tickIntervalId = null;
  var audioCtx = null;

  // ---- Ton-Signale -------------------------------------------------------
  // Vier unterscheidbare Signale: Vorbereitung-Start, Wechsel zu Belastung
  // ("Los"), Wechsel zu Pause, Abschluss.

  function ensureAudioCtx() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  function beep(freq, durationMs, delayMs, type) {
    var ctx = ensureAudioCtx();
    if (!ctx) return;
    setTimeout(function () {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      var now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.02);
    }, delayMs || 0);
  }

  function vibrate(durationMs) {
    var haptics = window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.Haptics : null;
    if (haptics && haptics.vibrate) {
      haptics.vibrate({ duration: durationMs }).catch(function () {});
    } else if (navigator.vibrate) {
      navigator.vibrate(durationMs);
    }
  }

  function signalPrepStart() {
    beep(500, 300, 0, 'sine');
    vibrate(200);
  }

  function signalGo() {
    beep(900, 110, 0, 'square');
    beep(900, 110, 160, 'square');
    vibrate(300);
  }

  function signalRestStart() {
    beep(400, 400, 0, 'sine');
    vibrate(400);
  }

  function signalFinish() {
    beep(600, 150, 0, 'triangle');
    beep(800, 150, 170, 'triangle');
    beep(1000, 220, 340, 'triangle');
    vibrate(600);
  }

  // ---- Presets: Liste & Editor -------------------------------------------

  function formatSummary(preset) {
    var parts = [preset.workSec + 's ' + window.i18n.t('tabata.work') + ' / ' + preset.restSec + 's ' + window.i18n.t('tabata.rest')];
    parts.push(preset.rounds + ' ' + window.i18n.t(preset.rounds === 1 ? 'tabata.roundSingular' : 'tabata.roundPlural'));
    if (preset.prepEnabled) parts.push(preset.prepSec + 's ' + window.i18n.t('tabata.prepShort'));
    return parts.join(' · ');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function renderList() {
    listStack.querySelectorAll('.tile:not(.tile-add)').forEach(function (el) { el.remove(); });
    listStack.querySelectorAll('.empty-state').forEach(function (el) { el.remove(); });

    if (!presets.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.setAttribute('data-i18n', 'tabata.empty');
      empty.textContent = window.i18n.t('tabata.empty');
      listStack.insertBefore(empty, listStack.firstChild);
      return;
    }

    presets.forEach(function (preset) {
      var tile = document.createElement('div');
      tile.className = 'tile timer-tile';
      tile.setAttribute('data-id', preset.id);
      tile.innerHTML =
        '<div class="timer-tile-top">' +
          '<span class="timer-tile-label">' + escapeHtml(preset.label || window.i18n.t('tabata.defaultLabel')) + '</span>' +
          '<button type="button" class="icon-btn tabata-delete" aria-label="' + window.i18n.t('timer.delete') + '">✕</button>' +
        '</div>' +
        '<div class="location-tile-meta">' + formatSummary(preset) + '</div>' +
        '<div class="timer-tile-controls tile-actions">' +
          '<button type="button" class="btn primary tabata-start">' + window.i18n.t('stopwatch.start') + '</button>' +
        '</div>';

      tile.querySelector('.tabata-delete').addEventListener('click', function (evt) {
        evt.stopPropagation();
        window.storage.tabataPresets.remove(preset.id);
        presets = presets.filter(function (p) { return p.id !== preset.id; });
        renderList();
      });
      tile.querySelector('.tabata-start').addEventListener('click', function (evt) {
        evt.stopPropagation();
        openSession(preset);
      });

      listStack.insertBefore(tile, listStack.querySelector('.tile-add'));
    });
  }

  function openEditor() {
    editingId = null;
    modalTitle.textContent = window.i18n.t('tabata.newTitle');
    labelInput.value = '';
    workInput.value = 20;
    restInput.value = 10;
    roundsInput.value = 8;
    prepEnabledInput.checked = true;
    prepInput.value = 10;
    updatePrepVisibility();
    modal.classList.add('is-visible');
  }

  function updatePrepVisibility() {
    prepWrap.hidden = !prepEnabledInput.checked;
  }

  function closeEditor() {
    modal.classList.remove('is-visible');
  }

  function saveForm(evt) {
    evt.preventDefault();
    var work = parseInt(workInput.value, 10);
    var rest = parseInt(restInput.value, 10);
    var rounds = parseInt(roundsInput.value, 10);
    if (!work || work < 1 || !rest || rest < 1 || !rounds || rounds < 1) return;

    var preset = {
      id: window.storage.makeId(),
      label: labelInput.value.trim(),
      workSec: work,
      restSec: rest,
      rounds: rounds,
      prepEnabled: prepEnabledInput.checked,
      prepSec: parseInt(prepInput.value, 10) || 10
    };
    window.storage.tabataPresets.upsert(preset);
    presets = window.storage.tabataPresets.getAll();
    closeEditor();
    renderList();
  }

  // ---- Session -------------------------------------------------------

  function formatTime(totalSec) {
    var s = Math.max(0, totalSec);
    var mm = Math.floor(s / 60);
    var ss = s % 60;
    return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }

  function updatePhaseUi() {
    document.body.classList.remove('tabata-phase-prep', 'tabata-phase-work', 'tabata-phase-rest', 'tabata-phase-done');
    if (!session) return;
    document.body.classList.add('tabata-phase-' + session.phase);

    var labelKey = { prep: 'tabata.phasePrep', work: 'tabata.phaseWork', rest: 'tabata.phaseRest', done: 'tabata.phaseDone' }[session.phase];
    phaseLabelEl.textContent = window.i18n.t(labelKey);
    phaseLabelEl.className = 'tabata-phase-label tabata-phase-label-' + session.phase;
    timeEl.textContent = formatTime(session.remainingSec);
    sessionLabelEl.textContent = session.preset.label || window.i18n.t('tabata.defaultLabel');

    if (session.phase === 'done') {
      roundProgressEl.textContent = window.i18n.t('tabata.finished');
    } else {
      roundProgressEl.textContent = window.i18n.t('tabata.roundProgress')
        .replace('{current}', session.round)
        .replace('{total}', session.preset.rounds);
    }

    startPauseBtn.textContent = window.i18n.t(session.running ? 'stopwatch.stop' : 'stopwatch.start');
    startPauseBtn.hidden = session.phase === 'done';
  }

  function remainingSeconds() {
    return Math.ceil((session.endAt - Date.now()) / 1000);
  }

  function beginPhase(phase) {
    session.phase = phase;
    var seconds = phase === 'prep' ? session.preset.prepSec : phase === 'work' ? session.preset.workSec : session.preset.restSec;
    session.remainingSec = seconds;
    session.endAt = Date.now() + seconds * 1000;
  }

  function advancePhase() {
    if (session.phase === 'prep') {
      beginPhase('work');
      signalGo();
    } else if (session.phase === 'work') {
      beginPhase('rest');
      signalRestStart();
    } else if (session.phase === 'rest') {
      if (session.round < session.preset.rounds) {
        session.round += 1;
        beginPhase('work');
        signalGo();
      } else {
        finishSession();
      }
    }
  }

  function finishSession() {
    session.phase = 'done';
    session.running = false;
    session.remainingSec = 0;
    stopTicking();
    signalFinish();
    updatePhaseUi();
  }

  function tick() {
    if (!session || !session.running) return;
    var remaining = remainingSeconds();
    if (remaining <= 0) {
      advancePhase();
    } else {
      session.remainingSec = remaining;
    }
    updatePhaseUi();
  }

  function ensureTicking() {
    if (tickIntervalId) return;
    tickIntervalId = setInterval(tick, 250);
  }

  function stopTicking() {
    if (tickIntervalId) {
      clearInterval(tickIntervalId);
      tickIntervalId = null;
    }
  }

  function openSession(preset) {
    session = { preset: preset, phase: 'idle', round: 1, endAt: null, remainingSec: 0, running: false };
    document.getElementById('tabata-list-view').hidden = true;
    sessionView.hidden = false;
    resetToStart();
  }

  function resetToStart() {
    if (!session) return;
    stopTicking();
    session.running = false;
    session.round = 1;
    if (session.preset.prepEnabled) {
      session.phase = 'prep';
      session.remainingSec = session.preset.prepSec;
    } else {
      session.phase = 'work';
      session.remainingSec = session.preset.workSec;
    }
    session.endAt = null;
    updatePhaseUi();
  }

  function startPause() {
    if (!session || session.phase === 'done') return;
    if (session.running) {
      session.running = false;
      session.remainingSec = remainingSeconds();
      stopTicking();
    } else {
      var isFreshStart = session.endAt === null;
      session.endAt = Date.now() + session.remainingSec * 1000;
      session.running = true;
      if (isFreshStart) {
        if (session.phase === 'prep') signalPrepStart();
        else signalGo();
      }
      ensureTicking();
    }
    updatePhaseUi();
  }

  function goBack() {
    stopTicking();
    session = null;
    document.body.classList.remove('tabata-phase-prep', 'tabata-phase-work', 'tabata-phase-rest', 'tabata-phase-done');
    sessionView.hidden = true;
    document.getElementById('tabata-list-view').hidden = false;
  }

  // ---- Modus-Umschaltung Einfach/Intervall -------------------------------

  function setMode(mode) {
    modeSwitchButtons.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-timer-mode') === mode);
    });
    document.getElementById('timer-mode-simple').hidden = mode !== 'simple';
    document.getElementById('timer-mode-interval').hidden = mode !== 'interval';
  }

  function init() {
    listStack = document.querySelector('#tabata-list-view .tile-stack');
    sessionView = document.getElementById('tabata-session-view');
    modeSwitchButtons = Array.prototype.slice.call(document.querySelectorAll('#timer-mode-switch .toggle-btn'));

    modal = document.getElementById('tabata-modal');
    form = document.getElementById('tabata-form');
    modalTitle = document.getElementById('tabata-modal-title');
    labelInput = document.getElementById('tabata-label');
    workInput = document.getElementById('tabata-work');
    restInput = document.getElementById('tabata-rest');
    roundsInput = document.getElementById('tabata-rounds');
    prepEnabledInput = document.getElementById('tabata-prep-enabled');
    prepWrap = document.getElementById('tabata-prep-wrap');
    prepInput = document.getElementById('tabata-prep');

    sessionLabelEl = document.getElementById('tabata-session-label');
    phaseLabelEl = document.getElementById('tabata-phase-label');
    timeEl = document.getElementById('tabata-time');
    roundProgressEl = document.getElementById('tabata-round-progress');
    startPauseBtn = document.getElementById('tabata-start-pause');
    resetBtn = document.getElementById('tabata-reset');
    backBtn = document.getElementById('tabata-back');

    presets = window.storage.tabataPresets.getAll();

    modeSwitchButtons.forEach(function (btn) {
      btn.addEventListener('click', function () { setMode(btn.getAttribute('data-timer-mode')); });
    });

    document.querySelector('#tabata-list-view .tile-add').addEventListener('click', openEditor);
    document.getElementById('tabata-cancel').addEventListener('click', closeEditor);
    modal.querySelector('.modal-backdrop').addEventListener('click', closeEditor);
    form.addEventListener('submit', saveForm);
    prepEnabledInput.addEventListener('change', updatePrepVisibility);

    startPauseBtn.addEventListener('click', startPause);
    resetBtn.addEventListener('click', resetToStart);
    backBtn.addEventListener('click', goBack);

    renderList();
  }

  window.tabataTab = { init: init };
})();
