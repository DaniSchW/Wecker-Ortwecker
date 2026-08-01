(function () {
  'use strict';

  var RING_RADIUS = 45;
  var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  var RING_PERIOD_MS = 60000; // eine volle Ringumdrehung pro Minute

  var display, ringProgress, lapList, startStopBtn, lapResetBtn;

  var running = false;
  var startedAt = 0;
  var accumulatedMs = 0;
  var laps = [];
  var rafId = null;

  function elapsedMs() {
    return accumulatedMs + (running ? Date.now() - startedAt : 0);
  }

  function formatTime(ms) {
    var totalCentis = Math.floor(ms / 10);
    var centis = totalCentis % 100;
    var totalSeconds = Math.floor(totalCentis / 100);
    var seconds = totalSeconds % 60;
    var minutes = Math.floor(totalSeconds / 60);
    return (
      String(minutes).padStart(2, '0') + ':' +
      String(seconds).padStart(2, '0') + '.' +
      String(centis).padStart(2, '0')
    );
  }

  function updateDisplay() {
    var ms = elapsedMs();
    display.textContent = formatTime(ms);
    var progress = (ms % RING_PERIOD_MS) / RING_PERIOD_MS;
    var offset = RING_CIRCUMFERENCE * (1 - progress);
    ringProgress.setAttribute('stroke-dasharray', RING_CIRCUMFERENCE);
    ringProgress.setAttribute('stroke-dashoffset', offset);
  }

  function tick() {
    updateDisplay();
    if (running) rafId = requestAnimationFrame(tick);
  }

  function start() {
    running = true;
    startedAt = Date.now();
    startStopBtn.textContent = window.i18n.t('stopwatch.stop');
    startStopBtn.classList.remove('primary');
    startStopBtn.classList.add('danger');
    lapResetBtn.textContent = window.i18n.t('stopwatch.lap');
    lapResetBtn.disabled = false;
    tick();
  }

  function stop() {
    accumulatedMs = elapsedMs();
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    startStopBtn.textContent = window.i18n.t('stopwatch.start');
    startStopBtn.classList.remove('danger');
    startStopBtn.classList.add('primary');
    lapResetBtn.textContent = window.i18n.t('stopwatch.reset');
    updateDisplay();
  }

  function reset() {
    accumulatedMs = 0;
    laps = [];
    updateDisplay();
    renderLaps();
    lapResetBtn.disabled = true;
  }

  function addLap() {
    var total = elapsedMs();
    var previousTotal = laps.length ? laps[laps.length - 1].totalMs : 0;
    laps.push({ index: laps.length + 1, lapMs: total - previousTotal, totalMs: total });
    renderLaps();
  }

  function renderLaps() {
    lapList.innerHTML = '';
    if (!laps.length) {
      var empty = document.createElement('li');
      empty.className = 'empty-state';
      empty.setAttribute('data-i18n', 'stopwatch.noLaps');
      empty.textContent = window.i18n.t('stopwatch.noLaps');
      lapList.appendChild(empty);
      return;
    }
    laps.slice().reverse().forEach(function (lap) {
      var li = document.createElement('li');
      li.innerHTML =
        '<span>' + window.i18n.t('stopwatch.lap') + ' ' + lap.index + '</span>' +
        '<span>' + formatTime(lap.lapMs) + '</span>' +
        '<span>' + formatTime(lap.totalMs) + '</span>';
      lapList.appendChild(li);
    });
  }

  function onStartStop() {
    if (running) stop(); else start();
  }

  function onLapReset() {
    if (running) {
      addLap();
    } else if (accumulatedMs > 0) {
      reset();
    }
  }

  function init() {
    display = document.querySelector('.stopwatch-time');
    ringProgress = document.querySelector('.ring-progress');
    lapList = document.querySelector('.lap-list');
    startStopBtn = document.getElementById('stopwatch-start-stop');
    lapResetBtn = document.getElementById('stopwatch-lap-reset');

    startStopBtn.addEventListener('click', onStartStop);
    lapResetBtn.addEventListener('click', onLapReset);

    lapResetBtn.disabled = true;
    updateDisplay();
  }

  window.stopwatchTab = { init: init };
})();
