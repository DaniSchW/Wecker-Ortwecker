(function () {
  'use strict';

  var DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mo..So (JS getDay(): 0=So)
  var DAY_KEYS = ['weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri', 'weekday.sat', 'weekday.sun'];

  var grid, modal, form, timeInput, labelInput, soundInputs, dayButtons, deleteBtn, modalTitle;
  var snoozeEnabledCheckbox, snoozeOptions, snoozeMinutesSelect;
  var ringOverrideCheckbox, ringOverrideOptions, ringDurationInput, pauseDurationInput, maxCyclesInput;
  var editingId = null;

  function formatDays(days) {
    if (!days || !days.length) return window.i18n.t('alarm.once');
    if (days.length === 7) return window.i18n.t('alarm.daily');
    return DAY_ORDER
      .filter(function (d) { return days.indexOf(d) !== -1; })
      .map(function (d) { return window.i18n.t(DAY_KEYS[DAY_ORDER.indexOf(d)]).slice(0, 2); })
      .join(', ');
  }

  function render() {
    var alarms = window.storage.alarms.getAll().sort(function (a, b) {
      return a.time.localeCompare(b.time);
    });

    grid.querySelectorAll('.tile:not(.tile-add)').forEach(function (el) { el.remove(); });
    grid.querySelectorAll('.empty-state').forEach(function (el) { el.remove(); });

    if (!alarms.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.setAttribute('data-i18n', 'alarm.empty');
      empty.textContent = window.i18n.t('alarm.empty');
      grid.insertBefore(empty, grid.firstChild);
      return;
    }

    alarms.forEach(function (alarm) {
      var tile = document.createElement('div');
      tile.className = 'tile alarm-tile' + (alarm.enabled ? '' : ' is-disabled');
      tile.setAttribute('data-id', alarm.id);
      tile.innerHTML =
        '<div class="alarm-tile-top">' +
          '<span class="alarm-tile-time">' + alarm.time + '</span>' +
          '<label class="switch">' +
            '<input type="checkbox" class="alarm-toggle"' + (alarm.enabled ? ' checked' : '') + ' aria-label="' + window.i18n.t('alarm.toggle') + '">' +
            '<span class="switch-track"><span class="switch-thumb"></span></span>' +
          '</label>' +
        '</div>' +
        '<div class="alarm-tile-label">' + (alarm.label ? escapeHtml(alarm.label) : window.i18n.t('alarm.defaultRingingTitle')) + '</div>' +
        '<div class="alarm-tile-days">' + formatDays(alarm.days) + '</div>';

      tile.querySelector('.alarm-toggle').addEventListener('change', function (evt) {
        evt.stopPropagation();
        toggleEnabled(alarm.id, evt.target.checked);
      });
      tile.addEventListener('click', function (evt) {
        if (evt.target.closest('.switch')) return;
        openEditor(alarm.id);
      });

      grid.insertBefore(tile, grid.querySelector('.tile-add'));
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Werbebanner im Voraus laden, solange mindestens ein Wecker scharf ist -
  // derselbe Vorlade-Mechanismus wie bei den Orts-Zeit-Weckern (siehe
  // locationAlarms.js/ads.js), damit der Klingel-Bildschirm die Anzeige
  // moeglichst sofort zeigen kann statt erst beim Klingeln zu laden.
  function maybePreloadRingingBanner() {
    var hasEnabled = window.storage.alarms.getAll().some(function (a) { return a.enabled; });
    if (hasEnabled) window.ads.preloadRingingBanner();
  }

  function toggleEnabled(id, enabled) {
    var alarms = window.storage.alarms.getAll();
    var alarm = alarms.find(function (a) { return a.id === id; });
    if (!alarm) return;
    alarm.enabled = enabled;
    window.storage.alarms.upsert(alarm);
    if (enabled) {
      scheduleAlarm(alarm);
    } else {
      window.Notify.cancel(alarm.notificationIds || []);
      cancelSnooze(alarm);
      window.locationAlarmBridge.cancelStandardAlarm(alarm.id);
    }
    render();
    maybePreloadRingingBanner();
  }

  function cancelSnooze(alarm) {
    if (!alarm.snoozeNotificationId) return;
    window.Notify.cancel([alarm.snoozeNotificationId]);
    alarm.snoozeNotificationId = null;
    window.storage.alarms.upsert(alarm);
  }

  function openEditor(id) {
    editingId = id || null;
    var alarm = id ? window.storage.alarms.getAll().find(function (a) { return a.id === id; }) : null;

    modalTitle.textContent = alarm ? window.i18n.t('alarm.editTitle') : window.i18n.t('alarm.newTitle');
    timeInput.value = alarm ? alarm.time : defaultTime();
    labelInput.value = alarm ? (alarm.label || '') : '';

    dayButtons.forEach(function (btn) {
      var day = parseInt(btn.getAttribute('data-day'), 10);
      var active = alarm ? alarm.days.indexOf(day) !== -1 : false;
      btn.classList.toggle('is-active', active);
    });

    var sound = alarm ? alarm.sound : 'both';
    soundInputs.forEach(function (input) {
      input.checked = input.value === sound;
    });

    snoozeEnabledCheckbox.checked = alarm ? alarm.snoozeEnabled !== false : true;
    snoozeMinutesSelect.value = String(alarm && alarm.snoozeMinutes ? alarm.snoozeMinutes : 10);
    updateSnoozeVisibility();

    var ringDefaults = window.ringSettings.get();
    ringOverrideCheckbox.checked = !!(alarm && alarm.ringOverrideEnabled);
    ringDurationInput.value = String(alarm && alarm.ringDurationSec ? alarm.ringDurationSec : ringDefaults.ringDurationSec);
    pauseDurationInput.value = String(Math.round((alarm && alarm.pauseDurationSec ? alarm.pauseDurationSec : ringDefaults.pauseDurationSec) / 60));
    maxCyclesInput.value = String(alarm && alarm.maxCycles ? alarm.maxCycles : ringDefaults.maxCycles);
    updateRingOverrideVisibility();

    deleteBtn.hidden = !alarm;
    modal.classList.add('is-visible');
  }

  function updateSnoozeVisibility() {
    snoozeOptions.hidden = !snoozeEnabledCheckbox.checked;
  }

  function updateRingOverrideVisibility() {
    ringOverrideOptions.hidden = !ringOverrideCheckbox.checked;
  }

  function defaultTime() {
    var d = new Date();
    d.setMinutes(d.getMinutes() + 1);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function closeEditor() {
    modal.classList.remove('is-visible');
    editingId = null;
  }

  function scheduleAlarm(alarm) {
    window.Notify.cancel(alarm.notificationIds || []);
    if (!alarm.enabled) {
      alarm.notificationIds = [];
      window.storage.alarms.upsert(alarm);
      window.locationAlarmBridge.cancelStandardAlarm(alarm.id);
      return;
    }

    var channelId = window.Notify.channelFor(alarm.sound);
    var notifications = [];
    var ids = [];

    if (!alarm.days.length) {
      var id = window.Notify.nextId();
      ids.push(id);
      notifications.push({
        id: id,
        title: alarm.label || window.i18n.t('alarm.defaultRingingTitle'),
        body: alarm.time,
        channelId: channelId,
        // allowWhileIdle: der Wecker muss auch dann puenktlich ausloesen,
        // wenn das Geraet zum Ausloesezeitpunkt im Doze-Modus ist (z.B.
        // ueber Nacht, Bildschirm aus, lange Inaktivitaet) - ohne dieses
        // Flag kann das Plugin (bzw. dessen Fallback ohne Exact-Alarm-
        // Berechtigung) den Alarm um Stunden verzoegern oder erst beim
        // naechsten System-Wartungsfenster ausloesen.
        schedule: { at: window.Notify.nextOccurrence(alarm.time, null), allowWhileIdle: true },
        extra: { type: 'alarm', alarmId: alarm.id }
      });
    } else {
      alarm.days.forEach(function (day) {
        var nid = window.Notify.nextId();
        ids.push(nid);
        notifications.push({
          id: nid,
          title: alarm.label || window.i18n.t('alarm.defaultRingingTitle'),
          body: alarm.time,
          channelId: channelId,
          schedule: {
            on: { weekday: window.Notify.toCapacitorWeekday(day), hour: parseInt(alarm.time.split(':')[0], 10), minute: parseInt(alarm.time.split(':')[1], 10) },
            repeats: true,
            allowWhileIdle: true
          },
          extra: { type: 'alarm', alarmId: alarm.id }
        });
      });
    }

    alarm.notificationIds = ids;
    window.storage.alarms.upsert(alarm);
    window.Notify.schedule(notifications);
    scheduleNativeBackupAlarm(alarm);
  }

  // Stellt zusaetzlich zur normalen @capacitor/local-notifications-Planung
  // (oben) einen zweiten, rein nativ verwalteten Backup-Alarm (siehe
  // StandardAlarmReceiver.java) - dieser loest den vollen Vollbild-/
  // Dauerklingel-Mechanismus auch dann aus, wenn der App-Prozess beim
  // Ausloese-Zeitpunkt komplett beendet ist (siehe README, Bugfix-Abschnitt).
  function scheduleNativeBackupAlarm(alarm) {
    var hour = parseInt(alarm.time.split(':')[0], 10);
    var minute = parseInt(alarm.time.split(':')[1], 10);
    var triggerAtMillis;
    var weekdays;
    if (!alarm.days.length) {
      triggerAtMillis = window.Notify.nextOccurrence(alarm.time, null).getTime();
      weekdays = [];
    } else {
      triggerAtMillis = Math.min.apply(null, alarm.days.map(function (day) {
        return window.Notify.nextOccurrence(alarm.time, day).getTime();
      }));
      weekdays = alarm.days.map(window.Notify.toCapacitorWeekday);
    }
    window.locationAlarmBridge.scheduleStandardAlarm({
      alarm: alarm,
      triggerAtMillis: triggerAtMillis,
      hour: hour,
      minute: minute,
      weekdays: weekdays
    });
  }

  function saveForm(evt) {
    evt.preventDefault();
    var time = timeInput.value;
    if (!time) return;

    var days = dayButtons
      .filter(function (btn) { return btn.classList.contains('is-active'); })
      .map(function (btn) { return parseInt(btn.getAttribute('data-day'), 10); });

    var sound = 'both';
    soundInputs.forEach(function (input) { if (input.checked) sound = input.value; });

    var alarm = editingId
      ? window.storage.alarms.getAll().find(function (a) { return a.id === editingId; })
      : { id: window.storage.makeId(), enabled: true, notificationIds: [] };

    alarm.time = time;
    alarm.label = labelInput.value.trim();
    alarm.days = days;
    alarm.sound = sound;
    alarm.snoozeEnabled = snoozeEnabledCheckbox.checked;
    alarm.snoozeMinutes = parseInt(snoozeMinutesSelect.value, 10) || 10;
    alarm.ringOverrideEnabled = ringOverrideCheckbox.checked;
    alarm.ringDurationSec = parseInt(ringDurationInput.value, 10) || window.ringSettings.DEFAULTS.ringDurationSec;
    alarm.pauseDurationSec = (parseInt(pauseDurationInput.value, 10) || 5) * 60;
    alarm.maxCycles = parseInt(maxCyclesInput.value, 10) || window.ringSettings.DEFAULTS.maxCycles;
    if (alarm.enabled === undefined) alarm.enabled = true;

    window.storage.alarms.upsert(alarm);
    scheduleAlarm(alarm);
    closeEditor();
    render();
    maybePreloadRingingBanner();
  }

  function deleteAlarm() {
    if (!editingId) return;
    var alarm = window.storage.alarms.getAll().find(function (a) { return a.id === editingId; });
    if (alarm) {
      window.Notify.cancel(alarm.notificationIds || []);
      if (alarm.snoozeNotificationId) window.Notify.cancel([alarm.snoozeNotificationId]);
      window.locationAlarmBridge.cancelStandardAlarm(alarm.id);
    }
    window.storage.alarms.remove(editingId);
    closeEditor();
    render();
    maybePreloadRingingBanner();
  }

  function handleSnooze(alarm) {
    var minutes = alarm.snoozeMinutes || 10;
    var target = new Date(Date.now() + minutes * 60000);
    var id = window.Notify.nextId();
    window.Notify.schedule([{
      id: id,
      title: alarm.label || window.i18n.t('alarm.defaultRingingTitle'),
      body: window.i18n.t('alarm.snoozedNotificationBody'),
      channelId: window.Notify.channelFor(alarm.sound),
      schedule: { at: target, allowWhileIdle: true },
      extra: { type: 'alarm', alarmId: alarm.id }
    }]);
    alarm.snoozeNotificationId = id;
    window.storage.alarms.upsert(alarm);
    // Ersetzt den Backup-Alarm (siehe scheduleNativeBackupAlarm) durch den
    // neuen Schlummern-Zeitpunkt - keine Wochentag-Wiederholung, also
    // einmalig (weekdays: []).
    window.locationAlarmBridge.scheduleStandardAlarm({
      alarm: alarm,
      triggerAtMillis: target.getTime(),
      hour: target.getHours(),
      minute: target.getMinutes(),
      weekdays: []
    });
  }

  function onRingStopped(stoppedAlarm) {
    if (!stoppedAlarm.days.length) {
      stoppedAlarm.enabled = false;
      stoppedAlarm.notificationIds = [];
    }
    stoppedAlarm.snoozeNotificationId = null;
    window.storage.alarms.upsert(stoppedAlarm);
    render();
  }

  // Reagiert auf das Feuern der über @capacitor/local-notifications
  // geplanten Benachrichtigung, waehrend die JS-Pipeline bereits laeuft
  // (Vordergrund oder Hintergrund, Prozess lebt). Loest auf nativer
  // Plattform IMMER den echten Dauerklingel-Mechanismus aus (Vollbild-Intent
  // + eigenstaendige Ton-/Vibrations-/Zyklen-Steuerung ueber
  // AlarmRingService, siehe locationAlarmBridge.js) statt sich auf den
  // einmaligen Kanal-Ton der Benachrichtigung zu verlassen - und zeigt das
  // Overlay direkt selbst, da die App ja bereits aktiv ist und nicht erst
  // ueber den Vollbild-Intent-Umweg (MainActivity.consumePendingAlarm())
  // starten muss.
  function handleFire(evt) {
    var extra = evt.notification && evt.notification.extra;
    if (!extra || extra.type !== 'alarm') return;
    var alarm = window.storage.alarms.getAll().find(function (a) { return a.id === extra.alarmId; });
    if (!alarm) return;
    alarm.snoozeNotificationId = null;

    if (window.locationAlarmBridge.isNative()) {
      window.locationAlarmBridge.ringFullScreenAlarm({ kind: 'standard', alarm: alarm, enter: true });
      window.ringing.show(alarm, onRingStopped, handleSnooze, { nativeAudio: true });
    } else {
      window.ringing.show(alarm, onRingStopped, handleSnooze);
    }
  }

  // Wird beim App-Start (kalter Start ueber den Vollbild-Intent) bzw. bei
  // einem erneuten Intent waehrend die App schon lief (onNewIntent) mit den
  // Daten aufgerufen, die AlarmNotifier der Benachrichtigung mitgegeben hat
  // - zeigt das Overlay mit nativ uebernommenem Ton/Vibration.
  function ringAlarmFromNativePending(pending) {
    if (pending.kind !== 'standard') return;
    if (window.ringing.isActive(pending.alarmId)) return;
    var alarm = window.storage.alarms.getAll().find(function (a) { return a.id === pending.alarmId; });
    if (!alarm) return;
    alarm.snoozeNotificationId = null;
    window.ringing.show(alarm, onRingStopped, handleSnooze, { nativeAudio: true });
  }

  function init() {
    grid = document.querySelector('#tab-alarm .tile-grid');
    modal = document.getElementById('alarm-modal');
    form = document.getElementById('alarm-form');
    timeInput = document.getElementById('alarm-time');
    labelInput = document.getElementById('alarm-label');
    soundInputs = Array.prototype.slice.call(document.querySelectorAll('input[name="alarm-sound"]'));
    dayButtons = Array.prototype.slice.call(document.querySelectorAll('#alarm-modal .weekday-picker button'));
    deleteBtn = document.getElementById('alarm-delete');
    modalTitle = document.getElementById('alarm-modal-title');
    snoozeEnabledCheckbox = document.getElementById('alarm-snooze-enabled');
    snoozeOptions = document.getElementById('alarm-snooze-options');
    snoozeMinutesSelect = document.getElementById('alarm-snooze-minutes');
    snoozeEnabledCheckbox.addEventListener('change', updateSnoozeVisibility);

    ringOverrideCheckbox = document.getElementById('alarm-ring-override-enabled');
    ringOverrideOptions = document.getElementById('alarm-ring-override-options');
    ringDurationInput = document.getElementById('alarm-ring-duration');
    pauseDurationInput = document.getElementById('alarm-pause-duration');
    maxCyclesInput = document.getElementById('alarm-max-cycles');
    ringOverrideCheckbox.addEventListener('change', updateRingOverrideVisibility);

    grid.querySelector('.tile-add').addEventListener('click', function () { openEditor(null); });
    document.getElementById('alarm-cancel').addEventListener('click', closeEditor);
    modal.querySelector('.modal-backdrop').addEventListener('click', closeEditor);
    form.addEventListener('submit', saveForm);
    deleteBtn.addEventListener('click', deleteAlarm);
    dayButtons.forEach(function (btn) {
      btn.addEventListener('click', function () { btn.classList.toggle('is-active'); });
    });

    window.Notify.onFire(handleFire);
    render();
    maybePreloadRingingBanner();
  }

  function rescheduleAll() {
    window.storage.alarms.getAll().forEach(function (alarm) {
      if (alarm.enabled) scheduleAlarm(alarm);
    });
    render();
    maybePreloadRingingBanner();
  }

  window.alarmsTab = {
    init: init,
    render: render,
    rescheduleAll: rescheduleAll,
    ringFromNativePending: ringAlarmFromNativePending
  };
})();
