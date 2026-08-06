(function () {
  'use strict';

  // Globale Standardwerte fuer das Dauerklingel-Verhalten (Klingeldauer,
  // Pausendauer zwischen Wiederholungen, maximale Anzahl Zyklen) - gilt
  // einheitlich fuer Standard-Wecker UND Orts-Zeit-Wecker, sofern ein
  // einzelner Alarm sie nicht per ringOverrideEnabled ueberschreibt (siehe
  // resolveForAlarm). Pausendauer wird intern/nativ in Sekunden gefuehrt,
  // in der Einstellungen-UI aber in Minuten angezeigt (siehe init()).
  var DEFAULTS = { ringDurationSec: 60, pauseDurationSec: 300, maxCycles: 3 };

  var ringDurationInput, pauseDurationMinutesInput, maxCyclesInput;

  function clamp(value, min, max, fallback) {
    var n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  }

  function get() {
    var stored = window.storage.ringSettings.get();
    return {
      ringDurationSec: clamp(stored.ringDurationSec, 10, 300, DEFAULTS.ringDurationSec),
      pauseDurationSec: clamp(stored.pauseDurationSec, 60, 1800, DEFAULTS.pauseDurationSec),
      maxCycles: clamp(stored.maxCycles, 1, 10, DEFAULTS.maxCycles)
    };
  }

  function save(values) {
    window.storage.ringSettings.save({
      ringDurationSec: clamp(values.ringDurationSec, 10, 300, DEFAULTS.ringDurationSec),
      pauseDurationSec: clamp(values.pauseDurationSec, 60, 1800, DEFAULTS.pauseDurationSec),
      maxCycles: clamp(values.maxCycles, 1, 10, DEFAULTS.maxCycles)
    });
  }

  // Liefert die tatsaechlich fuer diesen Alarm zu verwendenden Werte - eigene
  // Werte, falls ringOverrideEnabled gesetzt ist (und die jeweilige Zahl
  // gueltig ist), sonst die globalen Standardwerte.
  function resolveForAlarm(alarm) {
    var defaults = get();
    if (!alarm || !alarm.ringOverrideEnabled) return defaults;
    return {
      ringDurationSec: clamp(alarm.ringDurationSec, 10, 300, defaults.ringDurationSec),
      pauseDurationSec: clamp(alarm.pauseDurationSec, 60, 1800, defaults.pauseDurationSec),
      maxCycles: clamp(alarm.maxCycles, 1, 10, defaults.maxCycles)
    };
  }

  function renderForm() {
    var values = get();
    ringDurationInput.value = String(values.ringDurationSec);
    pauseDurationMinutesInput.value = String(Math.round(values.pauseDurationSec / 60));
    maxCyclesInput.value = String(values.maxCycles);
  }

  function persistFromForm() {
    save({
      ringDurationSec: ringDurationInput.value,
      pauseDurationSec: (parseInt(pauseDurationMinutesInput.value, 10) || 5) * 60,
      maxCycles: maxCyclesInput.value
    });
  }

  function init() {
    ringDurationInput = document.getElementById('settings-ring-duration');
    pauseDurationMinutesInput = document.getElementById('settings-pause-duration');
    maxCyclesInput = document.getElementById('settings-max-cycles');
    if (!ringDurationInput || !pauseDurationMinutesInput || !maxCyclesInput) return;

    renderForm();
    [ringDurationInput, pauseDurationMinutesInput, maxCyclesInput].forEach(function (input) {
      input.addEventListener('change', persistFromForm);
    });
  }

  window.ringSettings = {
    DEFAULTS: DEFAULTS,
    get: get,
    save: save,
    resolveForAlarm: resolveForAlarm,
    init: init
  };
})();
