(function () {
  'use strict';

  var DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mo..So (JS getDay(): 0=So)
  var DAY_KEYS = ['weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri', 'weekday.sat', 'weekday.sun'];

  var grid, modal, form, modalTitle;
  var titleInput, descriptionInput;
  var triggerButtons, repeatButtons, periodicOptions, periodicUnitSelect, periodicCustomWrap, periodicCustomInput;
  var commuteCheckbox, commuteOptions, commuteDayButtons, commuteStart, commuteEnd;
  var soundInputs, deleteBtn;
  var bgModal, bgAllowBtn, bgLaterBtn;
  var picker = null;
  var editingId = null;
  var geoStarted = false;
  var BG_PROMPT_DISMISSED_KEY = 'wo.bgLocationPromptDismissed';

  function repeatSummary(alarm) {
    if (alarm.repeatType === 'once') return window.i18n.t('locationAlarm.repeatOnce');
    if (alarm.repeatType === 'permanent') return window.i18n.t('locationAlarm.repeatPermanent');
    var unitKey = {
      daily: 'locationAlarm.periodicDaily',
      weekly: 'locationAlarm.periodicWeekly',
      monthly: 'locationAlarm.periodicMonthly',
      custom: 'locationAlarm.periodicCustom'
    }[alarm.periodicUnit || 'daily'];
    return window.i18n.t('locationAlarm.repeatPeriodic') + ' · ' + window.i18n.t(unitKey);
  }

  function render() {
    var alarms = window.storage.locationAlarms.getAll();

    grid.querySelectorAll('.tile:not(.tile-add)').forEach(function (el) { el.remove(); });
    grid.querySelectorAll('.empty-state').forEach(function (el) { el.remove(); });

    if (!alarms.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.setAttribute('data-i18n', 'locationAlarm.empty');
      empty.textContent = window.i18n.t('locationAlarm.empty');
      grid.insertBefore(empty, grid.firstChild);
      return;
    }

    alarms.forEach(function (alarm) {
      var tile = document.createElement('div');
      tile.className = 'tile location-alarm-tile' + (alarm.enabled ? '' : ' is-disabled');
      tile.setAttribute('data-id', alarm.id);
      var count = alarm.locations ? alarm.locations.length : 0;
      tile.innerHTML =
        '<div class="alarm-tile-top">' +
          '<span class="location-tile-title">' + escapeHtml(alarm.title) + '</span>' +
          '<label class="switch">' +
            '<input type="checkbox" class="location-alarm-toggle"' + (alarm.enabled ? ' checked' : '') + ' aria-label="' + window.i18n.t('locationAlarm.toggle') + '">' +
            '<span class="switch-track"><span class="switch-thumb"></span></span>' +
          '</label>' +
        '</div>' +
        '<div class="location-tile-meta">' + count + ' ' + window.i18n.t(count === 1 ? 'locationAlarm.locationSingular' : 'locationAlarm.locationPlural') +
          ' · ' + window.i18n.t(alarm.trigger === 'departure' ? 'locationAlarm.departure' : 'locationAlarm.arrival') + '</div>' +
        '<div class="alarm-tile-days">' + repeatSummary(alarm) + '</div>';

      tile.querySelector('.location-alarm-toggle').addEventListener('change', function (evt) {
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
    div.textContent = str || '';
    return div.innerHTML;
  }

  function toggleEnabled(id, enabled) {
    var alarm = window.storage.locationAlarms.getAll().find(function (a) { return a.id === id; });
    if (!alarm) return;
    alarm.enabled = enabled;
    window.storage.locationAlarms.upsert(alarm);
    render();
    syncTracking();
    if (enabled) maybePromptBackgroundPermission();
  }

  function setActiveToggle(buttons, value, attr) {
    buttons.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute(attr) === value);
    });
  }

  function activeToggleValue(buttons, attr) {
    var active = buttons.find(function (btn) { return btn.classList.contains('is-active'); });
    return active ? active.getAttribute(attr) : null;
  }

  function updatePeriodicVisibility() {
    var repeat = activeToggleValue(repeatButtons, 'data-repeat');
    periodicOptions.hidden = repeat !== 'periodic';
    periodicCustomWrap.hidden = periodicUnitSelect.value !== 'custom';
  }

  function updateCommuteVisibility() {
    commuteOptions.hidden = !commuteCheckbox.checked;
  }

  function openEditor(id) {
    editingId = id || null;
    var alarm = id ? window.storage.locationAlarms.getAll().find(function (a) { return a.id === id; }) : null;

    modalTitle.textContent = alarm ? window.i18n.t('locationAlarm.editTitle') : window.i18n.t('locationAlarm.newTitle');
    titleInput.value = alarm ? alarm.title : '';
    descriptionInput.value = alarm ? (alarm.description || '') : '';

    setActiveToggle(triggerButtons, alarm ? alarm.trigger : 'arrival', 'data-trigger');
    setActiveToggle(repeatButtons, alarm ? alarm.repeatType : 'once', 'data-repeat');
    periodicUnitSelect.value = alarm ? (alarm.periodicUnit || 'daily') : 'daily';
    periodicCustomInput.value = alarm ? (alarm.periodicCustomDays || 30) : 30;
    updatePeriodicVisibility();

    var commute = alarm && alarm.commute ? alarm.commute : { enabled: false, weekdays: [], start: '07:00', end: '09:00' };
    commuteCheckbox.checked = !!commute.enabled;
    commuteDayButtons.forEach(function (btn) {
      var day = parseInt(btn.getAttribute('data-day'), 10);
      btn.classList.toggle('is-active', (commute.weekdays || []).indexOf(day) !== -1);
    });
    commuteStart.value = commute.start || '07:00';
    commuteEnd.value = commute.end || '09:00';
    updateCommuteVisibility();

    var sound = alarm ? alarm.sound : 'both';
    soundInputs.forEach(function (input) { input.checked = input.value === sound; });

    picker.setLocations(alarm ? alarm.locations : []);
    picker.setRadius(alarm ? alarm.radius : 150);

    deleteBtn.hidden = !alarm;
    modal.classList.add('is-visible');
    setTimeout(function () { picker.invalidateSize(); }, 60);
  }

  function closeEditor() {
    modal.classList.remove('is-visible');
    editingId = null;
  }

  function saveForm(evt) {
    evt.preventDefault();
    var title = titleInput.value.trim();
    if (!title) return;

    var locations = picker.getLocations();
    if (!locations.length) return;

    var alarm = editingId
      ? window.storage.locationAlarms.getAll().find(function (a) { return a.id === editingId; })
      : {
          id: window.storage.makeId(),
          enabled: true,
          consumed: false,
          lastTriggeredAt: null,
          lastTriggeredPeriodKey: null
        };

    alarm.title = title;
    alarm.description = descriptionInput.value.trim();
    alarm.locations = locations.map(function (loc) {
      var existing = (alarm.locations || []).find(function (l) { return l.id === loc.id; });
      return { id: loc.id, lat: loc.lat, lng: loc.lng, label: loc.label, wasInside: existing ? existing.wasInside : false };
    });
    alarm.radius = picker.getRadius();
    alarm.trigger = activeToggleValue(triggerButtons, 'data-trigger') || 'arrival';

    var repeatType = activeToggleValue(repeatButtons, 'data-repeat') || 'once';
    if (repeatType !== alarm.repeatType) {
      alarm.consumed = false;
      alarm.lastTriggeredAt = null;
      alarm.lastTriggeredPeriodKey = null;
    }
    alarm.repeatType = repeatType;
    alarm.periodicUnit = periodicUnitSelect.value;
    alarm.periodicCustomDays = parseInt(periodicCustomInput.value, 10) || 30;

    alarm.commute = {
      enabled: commuteCheckbox.checked,
      weekdays: commuteDayButtons.filter(function (btn) { return btn.classList.contains('is-active'); }).map(function (btn) { return parseInt(btn.getAttribute('data-day'), 10); }),
      start: commuteStart.value || '07:00',
      end: commuteEnd.value || '09:00'
    };

    var sound = 'both';
    soundInputs.forEach(function (input) { if (input.checked) sound = input.value; });
    alarm.sound = sound;
    if (alarm.enabled === undefined) alarm.enabled = true;

    window.storage.locationAlarms.upsert(alarm);
    closeEditor();
    render();
    syncTracking();
    if (alarm.enabled) maybePromptBackgroundPermission();
  }

  function deleteAlarm() {
    if (!editingId) return;
    window.storage.locationAlarms.remove(editingId);
    closeEditor();
    render();
    syncTracking();
  }

  function ringAlarmNow(alarm) {
    window.locationRinging.show(alarm, function () {
      // Zustand wurde in geoTrigger.js bereits aktualisiert (verbraucht/Periode);
      // hier nur die Kachel-Ansicht auffrischen.
      render();
    });
  }

  function notifyAlarmInBackground(alarm) {
    var id = window.Notify.nextId();
    window.Notify.schedule([{
      id: id,
      title: alarm.title,
      body: alarm.description || window.i18n.t('locationAlarm.notificationBody'),
      channelId: window.Notify.channelFor(alarm.sound),
      schedule: { at: new Date() },
      extra: { type: 'locationAlarm', alarmId: alarm.id }
    }]);
  }

  function handleTrigger(alarm) {
    // Im Vordergrund direkt das Overlay zeigen (kein Umweg über eine
    // Benachrichtigung noetig). Im Hintergrund/bei geschlossener App gibt es
    // keine sichtbare Seite fuer ein Overlay - dort uebernimmt eine lokale
    // Benachrichtigung, deren Antippen (oder Eintreffen im Vordergrund) ueber
    // denselben Notify.onFire-Mechanismus wie Wecker/Timer das Overlay oeffnet.
    if (document.visibilityState === 'visible') {
      ringAlarmNow(alarm);
    } else {
      notifyAlarmInBackground(alarm);
    }
  }

  function handleNotificationFire(evt) {
    var extra = evt.notification && evt.notification.extra;
    if (!extra || extra.type !== 'locationAlarm') return;
    var alarm = window.storage.locationAlarms.getAll().find(function (a) { return a.id === extra.alarmId; });
    if (!alarm) return;
    ringAlarmNow(alarm);
  }

  function maybePromptBackgroundPermission() {
    if (!window.backgroundGeofence || !window.backgroundGeofence.isAvailable()) return;
    var dismissed = false;
    try { dismissed = localStorage.getItem(BG_PROMPT_DISMISSED_KEY) === '1'; } catch (e) {}
    if (dismissed) return;

    window.backgroundGeofence.checkPermissions().then(function (status) {
      if (!status || status.backgroundLocation === 'granted') return;
      bgModal.classList.add('is-visible');
    });
  }

  function dismissBackgroundPrompt() {
    try { localStorage.setItem(BG_PROMPT_DISMISSED_KEY, '1'); } catch (e) {}
    bgModal.classList.remove('is-visible');
  }

  function requestBackgroundPermissionFromModal() {
    window.backgroundGeofence.requestBackgroundPermission().then(function (status) {
      bgModal.classList.remove('is-visible');
      if (status && status.backgroundLocation !== 'granted') {
        try { localStorage.setItem(BG_PROMPT_DISMISSED_KEY, '1'); } catch (e) {}
      }
    });
  }

  function syncTracking() {
    var alarms = window.storage.locationAlarms.getAll();
    var hasEnabled = alarms.some(function (a) { return a.enabled; });

    // Vordergrund-Pfad (watchPosition) - reagiert sofort, solange die App offen ist.
    if (hasEnabled && !geoStarted) {
      window.geoTrigger.requestPermissions().then(function () {
        window.geoTrigger.start();
        geoStarted = true;
      });
    } else if (!hasEnabled && geoStarted) {
      window.geoTrigger.stop();
      geoStarted = false;
    }

    // Hintergrund-Pfad (native Geofences) - laeuft weiter, wenn die App
    // geschlossen/beendet ist. Kein separater Start/Stop noetig, die
    // Ortsliste wird einfach neu abgeglichen.
    if (window.backgroundGeofence && window.backgroundGeofence.isAvailable()) {
      window.backgroundGeofence.syncGeofences(alarms);
    }
  }

  function buildCommuteWeekdayPicker(container) {
    DAY_ORDER.forEach(function (day, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-day', String(day));
      btn.setAttribute('data-i18n', DAY_KEYS[idx]);
      btn.textContent = window.i18n.t(DAY_KEYS[idx]);
      btn.addEventListener('click', function () { btn.classList.toggle('is-active'); });
      container.appendChild(btn);
    });
  }

  function init() {
    grid = document.querySelector('#tab-location-alarm .tile-grid');
    modal = document.getElementById('location-alarm-modal');
    form = document.getElementById('location-alarm-form');
    modalTitle = document.getElementById('location-alarm-modal-title');
    titleInput = document.getElementById('loc-title');
    descriptionInput = document.getElementById('loc-description');

    triggerButtons = Array.prototype.slice.call(document.querySelectorAll('#loc-trigger-group .toggle-btn'));
    repeatButtons = Array.prototype.slice.call(document.querySelectorAll('#loc-repeat-group .toggle-btn'));
    periodicOptions = document.getElementById('periodic-options');
    periodicUnitSelect = document.getElementById('loc-periodic-unit');
    periodicCustomWrap = document.getElementById('periodic-custom-days');
    periodicCustomInput = document.getElementById('loc-periodic-custom-days');

    commuteCheckbox = document.getElementById('loc-commute-enabled');
    commuteOptions = document.getElementById('commute-options');
    var commuteWeekdayContainer = document.getElementById('commute-weekday-picker');
    buildCommuteWeekdayPicker(commuteWeekdayContainer);
    commuteDayButtons = Array.prototype.slice.call(commuteWeekdayContainer.querySelectorAll('button'));
    commuteStart = document.getElementById('loc-commute-start');
    commuteEnd = document.getElementById('loc-commute-end');

    soundInputs = Array.prototype.slice.call(document.querySelectorAll('input[name="loc-sound"]'));
    deleteBtn = document.getElementById('location-alarm-delete');

    bgModal = document.getElementById('background-permission-modal');
    bgAllowBtn = document.getElementById('background-permission-allow');
    bgLaterBtn = document.getElementById('background-permission-later');
    bgAllowBtn.addEventListener('click', requestBackgroundPermissionFromModal);
    bgLaterBtn.addEventListener('click', dismissBackgroundPrompt);
    bgModal.querySelector('.modal-backdrop').addEventListener('click', dismissBackgroundPrompt);

    picker = window.locationPicker.create(document.getElementById('location-picker-root'));

    grid.querySelector('.tile-add').addEventListener('click', function () { openEditor(null); });
    document.getElementById('location-alarm-cancel').addEventListener('click', closeEditor);
    modal.querySelector('.modal-backdrop').addEventListener('click', closeEditor);
    form.addEventListener('submit', saveForm);
    deleteBtn.addEventListener('click', deleteAlarm);

    triggerButtons.forEach(function (btn) {
      btn.addEventListener('click', function () { setActiveToggle(triggerButtons, btn.getAttribute('data-trigger'), 'data-trigger'); });
    });
    repeatButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setActiveToggle(repeatButtons, btn.getAttribute('data-repeat'), 'data-repeat');
        updatePeriodicVisibility();
      });
    });
    periodicUnitSelect.addEventListener('change', updatePeriodicVisibility);
    commuteCheckbox.addEventListener('change', updateCommuteVisibility);

    window.geoTrigger.onTrigger(handleTrigger);
    window.Notify.onFire(handleNotificationFire);

    render();
    syncTracking();
  }

  window.locationAlarmsTab = { init: init, render: render };
})();
