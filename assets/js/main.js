// Garage Morina – kleine Helfer, ohne Abhängigkeiten.
(function () {
  'use strict';

  // Bearbeitbare Daten aus content/site.json, erzeugt als assets/js/content.js.
  // Öffnungszeiten (0 = Sonntag). Zeiten in Minuten ab Mitternacht.
  var C = window.GM_CONTENT || {};
  var HOURS = C.hours;
  var CLOSURE = C.closure;
  var SEASON = C.season;
  var EMAIL = (C.contact && C.contact.email) || 'info@garage-morina.ch';
  var DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  // Aktuelle Zeit in Aarau, unabhängig von der Zeitzone des Besuchers.
  function zurichNow() {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Zurich', weekday: 'short', hour: '2-digit', minute: '2-digit',
      year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    var get = function (t) { return parts.find(function (p) { return p.type === t; }).value; };
    var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return {
      day: day, minutes: +get('hour') * 60 + +get('minute'), month: +get('month'),
      date: get('year') + '-' + get('month') + '-' + get('day')
    };
  }

  function fmt(m) {
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }

  // Datum "JJJJ-MM-TT" um n Tage verschieben (in UTC gerechnet, damit die Sommerzeit nicht stört)
  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function inClosure(iso) {
    return !!CLOSURE && iso >= CLOSURE.from && iso <= CLOSURE.to;
  }

  function nextOpening(now) {
    for (var i = 0; i < 60; i++) {
      var d = (now.day + i) % 7;
      var date = addDays(now.date, i);
      var slots = inClosure(date) ? [] : HOURS[d] || [];
      for (var s = 0; s < slots.length; s++) {
        if (i > 0 || slots[s][0] > now.minutes) {
          var p = date.split('-');
          var when = i === 0 ? 'heute' : i === 1 ? 'morgen' : i < 7 ? DAYS[d] : DAYS[d] + ', ' + +p[2] + '.' + +p[1] + '.';
          return when + ' um ' + fmt(slots[s][0]);
        }
      }
    }
    return '';
  }

  var now = zurichNow();

  // Status "Jetzt geöffnet". Ohne Daten bleibt der statische Text stehen.
  if (HOURS) document.querySelectorAll('[data-open-status]').forEach(function (el) {
    var slots = inClosure(now.date) ? [] : HOURS[now.day] || [];
    var open = slots.find(function (s) { return now.minutes >= s[0] && now.minutes < s[1]; });
    if (open) {
      el.textContent = 'Jetzt geöffnet – bis ' + fmt(open[1]) + ' Uhr';
      el.classList.add('is-open');
    } else {
      el.textContent = (inClosure(now.date) ? 'Betriebsferien' : 'Zurzeit geschlossen') + ' – wieder offen ' + nextOpening(now) + ' Uhr';
      el.classList.add('is-closed');
    }
  });

  // Heutigen Tag in der Öffnungszeiten-Tabelle hervorheben
  document.querySelectorAll('.hours tr[data-days]').forEach(function (tr) {
    if (tr.getAttribute('data-days').split(',').indexOf(String(now.day)) !== -1) tr.classList.add('today');
  });

  // Hinweis Betriebsferien, einige Tage vorher bis zum letzten Ferientag. Hat Vorrang vor dem Saisonhinweis.
  var closureNotice = document.querySelector('[data-closure-notice]');
  var closureShown = !!CLOSURE && now.date >= addDays(CLOSURE.from, -CLOSURE.showDaysBefore) && now.date <= CLOSURE.to;
  if (closureNotice && closureShown) {
    closureNotice.querySelector('[data-closure-text]').textContent = CLOSURE.text;
    closureNotice.hidden = false;
  }

  // Saisonhinweis Reifenwechsel, in den Monaten aus content/site.json
  var notice = document.querySelector('[data-season-notice]');
  var winter = !!SEASON && SEASON.winter.months.indexOf(now.month) !== -1;
  var summer = !!SEASON && SEASON.summer.months.indexOf(now.month) !== -1;
  if (notice && !closureShown && (winter || summer)) {
    var season = winter ? SEASON.winter : SEASON.summer;
    notice.querySelector('[data-season-text]').textContent = season.title + (season.body ? ': ' + season.body : '');
    notice.setAttribute('data-season', winter ? 'winter' : 'summer');
    // Mobil ersetzt ein runder Button den Balken; ein Tipp öffnet die Infobox
    var fab = notice.querySelector('[data-season-fab]');
    var pop = document.getElementById('season-pop');
    if (fab && pop) {
      pop.querySelector('[data-season-title]').textContent = season.title;
      pop.querySelector('[data-season-body]').textContent = season.body;
      fab.setAttribute('aria-label', winter ? 'Hinweis Winterreifen anzeigen' : 'Hinweis Sommerreifen anzeigen');

      var setOpen = function (open) {
        pop.hidden = !open;
        fab.setAttribute('aria-expanded', String(open));
      };
      fab.addEventListener('click', function () { setOpen(pop.hidden); });
      pop.querySelector('[data-season-close]').addEventListener('click', function () { setOpen(false); fab.focus(); });
      document.addEventListener('click', function (e) {
        if (!pop.hidden && !pop.contains(e.target) && !fab.contains(e.target)) setOpen(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !pop.hidden) { setOpen(false); fab.focus(); }
      });
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
      window.location.href = 'mailto:' + EMAIL + '?subject=' +encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      var done = document.getElementById('form-done');
      if (done) done.hidden = false;
    });
  }

  // Jahr im Footer
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
