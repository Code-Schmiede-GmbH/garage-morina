// Garage Morina – kleine Helfer, ohne Abhängigkeiten.
(function () {
  'use strict';

  // Öffnungszeiten (0 = Sonntag). Zeiten in Minuten ab Mitternacht.
  var HOURS = {
    1: [[480, 720], [810, 1080]],
    2: [[480, 720], [810, 1080]],
    3: [[480, 720], [810, 1080]],
    4: [[480, 720], [810, 1080]],
    5: [[480, 720], [810, 1080]],
    6: [[480, 720]]
  };
  var DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  // Aktuelle Zeit in Aarau, unabhängig von der Zeitzone des Besuchers.
  function zurichNow() {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Zurich', weekday: 'short', hour: '2-digit', minute: '2-digit', month: 'numeric', hourCycle: 'h23'
    }).formatToParts(new Date());
    var get = function (t) { return parts.find(function (p) { return p.type === t; }).value; };
    var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { day: day, minutes: +get('hour') * 60 + +get('minute'), month: +get('month') };
  }

  function fmt(m) {
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }

  function nextOpening(now) {
    for (var i = 0; i < 8; i++) {
      var d = (now.day + i) % 7;
      var slots = HOURS[d] || [];
      for (var s = 0; s < slots.length; s++) {
        if (i > 0 || slots[s][0] > now.minutes) {
          var when = i === 0 ? 'heute' : i === 1 ? 'morgen' : DAYS[d];
          return when + ' um ' + fmt(slots[s][0]);
        }
      }
    }
    return '';
  }

  var now = zurichNow();

  // Status "Jetzt geöffnet"
  document.querySelectorAll('[data-open-status]').forEach(function (el) {
    var slots = HOURS[now.day] || [];
    var open = slots.find(function (s) { return now.minutes >= s[0] && now.minutes < s[1]; });
    if (open) {
      el.textContent = 'Jetzt geöffnet – bis ' + fmt(open[1]) + ' Uhr';
      el.classList.add('is-open');
    } else {
      el.textContent = 'Zurzeit geschlossen – wieder offen ' + nextOpening(now) + ' Uhr';
      el.classList.add('is-closed');
    }
  });

  // Heutigen Tag in der Öffnungszeiten-Tabelle hervorheben
  document.querySelectorAll('.hours tr[data-days]').forEach(function (tr) {
    if (tr.getAttribute('data-days').split(',').indexOf(String(now.day)) !== -1) tr.classList.add('today');
  });

  // Saisonhinweis Reifenwechsel (März/April und Oktober/November)
  var notice = document.querySelector('[data-season-notice]');
  if (notice && [3, 4, 10, 11].indexOf(now.month) !== -1) {
    var winter = now.month >= 10;
    var text = winter
      ? 'Zeit für Winterreifen: Jetzt Termin für Reifenwechsel & Einlagerung sichern.'
      : 'Zeit für Sommerreifen: Jetzt Termin für Reifenwechsel & Einlagerung sichern.';
    notice.querySelector('[data-season-text]').textContent = text;
    notice.setAttribute('data-season', winter ? 'winter' : 'summer');
    // Mobil ersetzt ein runder Button den Balken
    var fab = notice.querySelector('[data-season-fab]');
    if (fab) {
      fab.setAttribute('aria-label', text + ' Termin anfragen');
      fab.title = winter ? 'Winterreifen: Termin anfragen' : 'Sommerreifen: Termin anfragen';
    }
    notice.hidden = false;
  }

  // Mobile Navigation
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });
  }

  // Google Maps erst nach Einwilligung laden
  var mapBtn = document.querySelector('[data-load-map]');
  if (mapBtn) {
    mapBtn.addEventListener('click', function () {
      var box = mapBtn.closest('.map-box');
      var iframe = document.createElement('iframe');
      iframe.src = box.getAttribute('data-map-src');
      iframe.title = 'Karte: Garage Morina, Weihermattstrasse 96, 5000 Aarau';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.allowFullscreen = true;
      box.innerHTML = '';
      box.appendChild(iframe);
    });
  }

  // Terminanfrage: baut eine E-Mail im Mailprogramm des Besuchers auf.
  // So werden keine Daten über Dritte übertragen (GitHub Pages hat kein Backend).
  var form = document.getElementById('termin-form');
  if (form) {
    var date = form.querySelector('[name="datum"]');
    if (date) {
      var t = new Date();
      date.min = t.toISOString().slice(0, 10);
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var v = function (n) { var f = form.elements[n]; return f ? f.value.trim() : ''; };
      var dateText = v('datum') ? new Date(v('datum') + 'T12:00').toLocaleDateString('de-CH') : '–';
      var body = [
        'Guten Tag Herr Morina',
        '',
        'Ich möchte gerne einen Termin anfragen.',
        '',
        'Name: ' + v('name'),
        'Telefon: ' + v('telefon'),
        'E-Mail: ' + (v('email') || '–'),
        'Fahrzeug: ' + (v('fahrzeug') || '–'),
        'Kontrollschild: ' + (v('kennzeichen') || '–'),
        'Gewünschte Leistung: ' + v('leistung'),
        'Wunschtermin: ' + dateText + (v('zeit') ? ', ' + v('zeit') : ''),
        '',
        'Bemerkungen:',
        v('nachricht') || '–',
        '',
        'Freundliche Grüsse',
        v('name')
      ].join('\n');
      var subject = 'Terminanfrage: ' + v('leistung') + (v('fahrzeug') ? ' – ' + v('fahrzeug') : '');
      window.location.href = 'mailto:info@garage-morina.ch?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      var done = document.getElementById('form-done');
      if (done) done.hidden = false;
    });
  }

  // Jahr im Footer
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
