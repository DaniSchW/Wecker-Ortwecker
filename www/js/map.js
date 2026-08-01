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

  function geocode(query) {
    if (!query || query.trim().length < 3) return Promise.resolve([]);
    var url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&q=' + encodeURIComponent(query);
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (results) {
        return (results || []).map(function (r) {
          return { label: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
        });
      })
      .catch(function () { return []; });
  }

  function createLocationPicker(root) {
    var mapEl = root.querySelector('.location-picker-map');
    var searchInput = root.querySelector('.location-picker-search');
    var resultsEl = root.querySelector('.location-picker-results');
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
      renderList();
      notifyChange();
    }

    function clearAll() {
      Object.keys(markers).forEach(function (id) {
        map.removeLayer(markers[id].marker);
        map.removeLayer(markers[id].circle);
      });
      markers = {};
      locations = [];
      renderList();
    }

    function setLocations(list) {
      clearAll();
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

    var runSearch = debounce(function (query) {
      geocode(query).then(function (results) {
        resultsEl.innerHTML = '';
        if (!results.length) { resultsEl.classList.remove('is-visible'); return; }
        results.forEach(function (r) {
          var item = document.createElement('button');
          item.type = 'button';
          item.className = 'location-picker-result';
          item.textContent = r.label;
          item.addEventListener('click', function () {
            addLocation(r.lat, r.lng, r.label);
            map.setView([r.lat, r.lng], PIN_ZOOM);
            searchInput.value = '';
            resultsEl.classList.remove('is-visible');
            resultsEl.innerHTML = '';
          });
          resultsEl.appendChild(item);
        });
        resultsEl.classList.add('is-visible');
      });
    }, 400);

    searchInput.addEventListener('input', function () { runSearch(searchInput.value); });
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
