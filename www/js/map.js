(function () {
  'use strict';

  var DEFAULT_CENTER = [51.1657, 10.4515]; // Deutschland, Kartenmitte als Startansicht
  var DEFAULT_ZOOM = 6;
  var PIN_ZOOM = 15;

  function haversineMeters(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var toRad = function (d) { return (d * Math.PI) / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  var NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
  // Nominatim-Nutzungsbedingungen verlangen einen aussagekräftigen User-Agent
  // oder Referer zur Identifikation der Anwendung. Vor Live-Schaltung durch
  // eine echte Kontaktadresse ersetzen (siehe auch PRIVACY.md-Platzhalter).
  var NOMINATIM_USER_AGENT = 'WeckerOrtswecker/1.0.0 (app.weckerundort.mobile; Kontakt: [PLATZHALTER: E-Mail-Adresse])';

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform());
  }

  // Geocoding-Anfrage an Nominatim. Wirft bei Netzwerk-/HTTP-Fehlern (damit
  // der Aufrufer das von "keine Treffer" unterscheiden und passend anzeigen
  // kann); liefert bei einer erfolgreichen Anfrage ohne Treffer ein leeres
  // Array. Auf einem nativen Gerät läuft die Anfrage über das in
  // @capacitor/core eingebaute CapacitorHttp-Plugin, damit sich (anders als
  // im Browser, wo "User-Agent" ein von fetch() nicht überschreibbarer
  // Header ist) der geforderte User-Agent tatsächlich setzen lässt.
  function geocode(query) {
    var q = (query || '').trim();
    if (q.length < 3) return Promise.resolve([]);

    var params = { format: 'json', addressdetails: '0', limit: '5', q: q };
    var request;

    if (isNative()) {
      request = window.Capacitor.Plugins.CapacitorHttp.get({
        url: NOMINATIM_ENDPOINT,
        params: params,
        headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_USER_AGENT }
      }).then(function (res) {
        if (res.status < 200 || res.status >= 300) throw new Error('Nominatim HTTP ' + res.status);
        return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      });
    } else {
      var url = NOMINATIM_ENDPOINT + '?' + new URLSearchParams(params).toString();
      request = fetch(url, { headers: { Accept: 'application/json' } }).then(function (res) {
        if (!res.ok) throw new Error('Nominatim HTTP ' + res.status);
        return res.json();
      });
    }

    return request.then(function (results) {
      return (results || []).map(function (r) {
        return { label: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
      });
    });
  }

  function createLocationPicker(root) {
    var mapEl = root.querySelector('.location-picker-map');
    var searchInput = root.querySelector('.location-picker-search');
    var resultsEl = root.querySelector('.location-picker-results');
    var geocodeStatusEl = root.querySelector('.location-picker-geocode-status');
    var listEl = root.querySelector('.location-picker-list');
    var radiusInput = root.querySelector('.location-picker-radius');
    var radiusValueEl = root.querySelector('.location-picker-radius-value');

    var map = L.map(mapEl, { attributionControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
    }).addTo(map);

    var locations = []; // { id, lat, lng, label }
    var markers = {}; // id -> { marker, circle }
    var changeCallback = null;
    // Verfolgt den zuletzt per Geocoding automatisch gesetzten Pin, damit
    // aufeinanderfolgende Tipp-/Auswahl-Ereignisse denselben Pin verschieben
    // statt bei jeder Eingabe einen neuen anzuhäufen. Wird der Pin manuell
    // verschoben oder entfernt, "löst" er sich davon (siehe unten) - danach
    // legt eine weitere Suche wieder einen neuen Pin an.
    var autoMarkerId = null;

    function setGeocodeStatus(text, isError) {
      geocodeStatusEl.textContent = text || '';
      geocodeStatusEl.classList.toggle('is-error', !!isError);
      geocodeStatusEl.classList.toggle('is-visible', !!text);
    }

    function radiusMeters() {
      return parseInt(radiusInput.value, 10) || 150;
    }

    function notifyChange() {
      if (changeCallback) changeCallback(locations.slice());
    }

    function renderList() {
      listEl.innerHTML = '';
      if (!locations.length) {
        var empty = document.createElement('li');
        empty.className = 'location-picker-empty';
        empty.setAttribute('data-i18n', 'locationAlarm.noLocations');
        empty.textContent = window.i18n.t('locationAlarm.noLocations');
        listEl.appendChild(empty);
        return;
      }
      locations.forEach(function (loc) {
        var li = document.createElement('li');
        li.className = 'location-picker-item';
        var label = document.createElement('span');
        label.textContent = loc.label || (loc.lat.toFixed(5) + ', ' + loc.lng.toFixed(5));
        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'icon-btn';
        removeBtn.textContent = '✕';
        removeBtn.setAttribute('aria-label', window.i18n.t('locationAlarm.removeLocation'));
        removeBtn.addEventListener('click', function () { removeLocation(loc.id); });
        li.appendChild(label);
        li.appendChild(removeBtn);
        listEl.appendChild(li);
      });
    }

    function updateCircle(id) {
      var entry = markers[id];
      if (!entry) return;
      entry.circle.setLatLng(entry.marker.getLatLng());
      entry.circle.setRadius(radiusMeters());
    }

    function addLocation(lat, lng, label, id) {
      // id wird beim Bearbeiten eines bestehenden Alarms von setLocations()
      // durchgereicht, damit die gespeicherte wasInside-Ankunfts-/Abfahrts-
      // Historie je Ort erhalten bleibt (sonst würde jedes Speichern die
      // Ortsverfolgung unbemerkt zurücksetzen). Neue Orte bekommen eine frische ID.
      id = id || window.storage.makeId();
      var marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      var circle = L.circle([lat, lng], { radius: radiusMeters(), color: '#3f6fd1', weight: 1.5, fillOpacity: 0.12 }).addTo(map);

      marker.on('drag', function () { updateCircle(id); });
      marker.on('dragend', function () {
        var pos = marker.getLatLng();
        var loc = locations.find(function (l) { return l.id === id; });
        if (loc) { loc.lat = pos.lat; loc.lng = pos.lng; }
        // Manuell nachjustierter Pin soll bei der naechsten Adresssuche nicht
        // mehr automatisch verschoben werden.
        if (id === autoMarkerId) autoMarkerId = null;
        notifyChange();
      });

      markers[id] = { marker: marker, circle: circle };
      locations.push({ id: id, lat: lat, lng: lng, label: label || '' });
      renderList();
      notifyChange();
      return id;
    }

    function removeLocation(id) {
      var entry = markers[id];
      if (entry) {
        map.removeLayer(entry.marker);
        map.removeLayer(entry.circle);
        delete markers[id];
      }
      locations = locations.filter(function (l) { return l.id !== id; });
      if (id === autoMarkerId) autoMarkerId = null;
      renderList();
      notifyChange();
    }

    // Setzt den zuletzt per Adresssuche automatisch platzierten Pin (falls
    // noch vorhanden) auf neue Koordinaten um, statt einen weiteren Pin
    // anzuhäufen - sonst würde jede erneute Debounce-Auswertung beim Tippen
    // einen zusätzlichen Ort hinzufügen. Gibt es (noch) keinen, wird einer
    // frisch angelegt und als der automatische gemerkt.
    function placeOrMoveAutoMarker(lat, lng, label) {
      var entry = markers[autoMarkerId];
      if (autoMarkerId && entry) {
        entry.marker.setLatLng([lat, lng]);
        updateCircle(autoMarkerId);
        var loc = locations.find(function (l) { return l.id === autoMarkerId; });
        if (loc) {
          loc.lat = lat;
          loc.lng = lng;
          loc.label = label || loc.label;
        }
        renderList();
        notifyChange();
      } else {
        autoMarkerId = addLocation(lat, lng, label);
      }
      map.setView([lat, lng], PIN_ZOOM);
    }

    function clearAll() {
      Object.keys(markers).forEach(function (id) {
        map.removeLayer(markers[id].marker);
        map.removeLayer(markers[id].circle);
      });
      markers = {};
      locations = [];
      autoMarkerId = null;
      renderList();
    }

    function setLocations(list) {
      clearAll();
      setGeocodeStatus('', false);
      searchInput.value = '';
      (list || []).forEach(function (loc) { addLocation(loc.lat, loc.lng, loc.label, loc.id); });
      if (locations.length) {
        var group = L.featureGroup(Object.keys(markers).map(function (id) { return markers[id].marker; }));
        map.fitBounds(group.getBounds().pad(0.4), { maxZoom: PIN_ZOOM });
      }
    }

    function getLocations() {
      return locations.slice();
    }

    map.on('click', function (evt) {
      addLocation(evt.latlng.lat, evt.latlng.lng, '');
    });

    radiusInput.addEventListener('input', function () {
      radiusValueEl.textContent = radiusMeters() + ' m';
      Object.keys(markers).forEach(updateCircle);
    });

    // Verwirft veraltete Geocoding-Antworten, falls der Nutzer trotz Debounce
    // schneller weitertippt als eine vorige Anfrage antwortet.
    var geocodeToken = 0;

    var runGeocode = debounce(function (query) {
      var q = (query || '').trim();
      var myToken = ++geocodeToken;

      if (q.length < 3) {
        resultsEl.classList.remove('is-visible');
        resultsEl.innerHTML = '';
        setGeocodeStatus('', false);
        return;
      }

      geocode(q).then(function (results) {
        if (myToken !== geocodeToken) return;
        resultsEl.innerHTML = '';

        if (!results.length) {
          resultsEl.classList.remove('is-visible');
          setGeocodeStatus(window.i18n.t('locationAlarm.geocodeNotFound'), true);
          return;
        }

        setGeocodeStatus('', false);
        // Bester Treffer wird direkt als Pin gesetzt/verschoben, damit man
        // nicht erst aus der Liste auswaehlen muss - die Liste bleibt fuer
        // abweichende Treffer trotzdem sichtbar (z. B. gleichnamige Strassen
        // in mehreren Staedten).
        placeOrMoveAutoMarker(results[0].lat, results[0].lng, results[0].label);

        results.forEach(function (r) {
          var item = document.createElement('button');
          item.type = 'button';
          item.className = 'location-picker-result';
          item.textContent = r.label;
          item.addEventListener('click', function () {
            placeOrMoveAutoMarker(r.lat, r.lng, r.label);
            searchInput.value = '';
            resultsEl.classList.remove('is-visible');
            resultsEl.innerHTML = '';
            setGeocodeStatus('', false);
          });
          resultsEl.appendChild(item);
        });
        resultsEl.classList.add('is-visible');
      }).catch(function (err) {
        if (myToken !== geocodeToken) return;
        console.error('map: Geocoding fehlgeschlagen', err);
        resultsEl.classList.remove('is-visible');
        resultsEl.innerHTML = '';
        setGeocodeStatus(window.i18n.t('locationAlarm.geocodeNetworkError'), true);
      });
    }, 500);

    searchInput.addEventListener('input', function () { runGeocode(searchInput.value); });
    searchInput.addEventListener('blur', function () {
      setTimeout(function () { resultsEl.classList.remove('is-visible'); }, 150);
    });

    setTimeout(function () { map.invalidateSize(); }, 50);

    return {
      setLocations: setLocations,
      getLocations: getLocations,
      setRadius: function (m) {
        radiusInput.value = m;
        radiusValueEl.textContent = m + ' m';
        Object.keys(markers).forEach(updateCircle);
      },
      getRadius: radiusMeters,
      onChange: function (cb) { changeCallback = cb; },
      invalidateSize: function () { map.invalidateSize(); }
    };
  }

  window.locationPicker = {
    create: createLocationPicker,
    haversineMeters: haversineMeters
  };
})();
