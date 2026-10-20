// Garage Morina – Website-Daten bearbeiten.
// Liest und speichert content/site.json direkt über die GitHub-API. Nach dem Speichern
// überträgt .github/workflows/deploy.yml die Werte in die Seiten und veröffentlicht sie.
(function () {
  'use strict';

  var OWNER = 'Code-Schmiede-GmbH';
  var REPO = 'garage-morina';
  var BRANCH = 'main';
  var FILE = 'content/site.json';
  var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
  var TOKEN_KEY = 'gm-admin-token';

  // Link auf das GitHub-Formular für einen neuen Zugangsschlüssel, mit vorausgefüllten Feldern
  var TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?' + [
    'name=' + encodeURIComponent('Website Garage Morina'),
    'description=' + encodeURIComponent('Öffnungszeiten und Hinweise unter /admin bearbeiten'),
    'target_name=' + OWNER,
    'expires_in=366',
    'contents=write',
    'actions=read'
  ].join('&');

  var DAYS = [['mon', 'Montag'], ['tue', 'Dienstag'], ['wed', 'Mittwoch'], ['thu', 'Donnerstag'], ['fri', 'Freitag'], ['sat', 'Samstag'], ['sun', 'Sonntag']];
  var MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  var $ = function (s, root) { return (root || document).querySelector(s); };
  var loading = $('[data-loading]');
  var login = $('[data-login]');
  var editor = $('[data-editor]');
  var status = $('[data-status]');
  var logout = $('[data-logout]');

  var token = '';
  var sha = '';     // Version von site.json, die gerade bearbeitet wird
  var data = null;
  var dirty = false;

  function readToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function writeToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  function api(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) { var err = new Error(json.message || res.statusText); err.status = res.status; throw err; }
        return json;
      });
    });
  }

  // UTF-8-sicheres Base64 (die GitHub-API liefert und erwartet Base64)
  function decode(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, function (c) { return c.charCodeAt(0); }));
  }
  function encode(text) {
    var bytes = new TextEncoder().encode(text), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function show(view) {
    loading.hidden = view !== 'loading';
    login.hidden = view !== 'login';
    editor.hidden = view !== 'editor';
    logout.hidden = view !== 'editor';
  }

  function setStatus(text, kind, link) {
    status.textContent = text;
    status.className = 'admin-msg' + (kind ? ' is-' + kind : '');
    if (link) {
      var a = document.createElement('a');
      a.href = link.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = link.text;
      status.appendChild(document.createTextNode(' '));
      status.appendChild(a);
    }
  }

  // --- Anmeldung ------------------------------------------------------------

  $('[data-token-link]').href = TOKEN_URL;

  function signIn(t) {
    token = t;
    show('loading');
    return api('').then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) {
        var err = new Error('no-write'); err.status = 403; throw err;
      }
      writeToken(t);
      return load();
    });
  }

  function loginError(err) {
    var msg = err.status === 401 ? 'Der Zugangsschlüssel ist ungültig oder abgelaufen.'
      : err.status === 404 ? 'Der Schlüssel hat keinen Zugriff auf «garage-morina». Beim Erstellen das Repository auswählen.'
      : err.status === 403 ? 'Der Schlüssel darf nicht speichern. Beim Erstellen «Contents: Read and write» wählen.'
      : 'Anmeldung fehlgeschlagen: ' + err.message;
    writeToken('');
    show('login');
    var box = $('[data-login-error]');
    box.textContent = msg;
    box.hidden = false;
  }

  login.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = login.elements.token.value.trim();
    if (t) signIn(t).catch(loginError);
  });

  logout.addEventListener('click', function () {
    if (dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
    dirty = false;
    writeToken('');
    token = '';
    login.elements.token.value = '';
    $('[data-login-error]').hidden = true;
    show('login');
  });

  // --- Laden und Formular füllen ---------------------------------------------

  function load() {
    return api('/contents/' + FILE + '?ref=' + BRANCH).then(function (file) {
      sha = file.sha;
      data = JSON.parse(decode(file.content));
      fill();
      dirty = false;
      setStatus('');
      show('editor');
    });
  }

  function field(name) { return editor.elements[name]; }

  function slotRow(value) {
    var parts = (value || '').split('-');
    var row = document.createElement('div');
    row.className = 'admin-slot';
    row.innerHTML = '<input type="time" step="300" aria-label="von" data-from> – <input type="time" step="300" aria-label="bis" data-to>' +
      '<button class="admin-remove" type="button" aria-label="Zeitfenster entfernen">&times;</button>';
    $('[data-from]', row).value = parts[0] || '';
    $('[data-to]', row).value = parts[1] || '';
    return row;
  }

  function updateClosed(day) {
    $('.admin-closed', day).hidden = !!$('.admin-slot', day);
  }

  function fill() {
    var days = $('[data-days]');
    days.innerHTML = '';
    DAYS.forEach(function (d) {
      var day = document.createElement('div');
      day.className = 'admin-day';
      day.setAttribute('data-day', d[0]);
      day.innerHTML = '<div class="admin-day-name">' + d[1] + '</div><div class="admin-slots"><span class="admin-closed">geschlossen</span>' +
        '<button class="admin-link" type="button" data-add>+ Zeitfenster</button></div>';
      var slots = $('.admin-slots', day), add = $('[data-add]', day);
      ((data.hours || {})[d[0]] || []).forEach(function (s) { slots.insertBefore(slotRow(s), add); });
      updateClosed(day);
      days.appendChild(day);
    });

    var c = data.closure || {};
    field('closure.active').checked = !!c.active;
    field('closure.from').value = c.from || '';
    field('closure.to').value = c.to || '';
    field('closure.showDaysBefore').value = c.showDaysBefore != null ? c.showDaysBefore : 14;
    field('closure.text').value = c.text || '';
    toggleClosure();

    ['winter', 'summer'].forEach(function (k) {
      var s = (data.season || {})[k] || {};
      var box = $('[data-season="' + k + '"] [data-months]');
      box.innerHTML = '';
      MONTHS.forEach(function (m, i) {
        var label = document.createElement('label');
        label.innerHTML = '<input type="checkbox" value="' + (i + 1) + '"><span>' + m + '</span>';
        label.firstChild.checked = (s.months || []).map(Number).indexOf(i + 1) !== -1;
        box.appendChild(label);
      });
      field('season.' + k + '.title').value = s.title || '';
      field('season.' + k + '.body').value = s.body || '';
    });

    var ct = data.contact || {};
    field('contact.mobile').value = ct.mobile || '';
    field('contact.landline').value = ct.landline || '';
    field('contact.email').value = ct.email || '';
  }

  function toggleClosure() {
    $('[data-closure-fields]').hidden = !field('closure.active').checked;
  }

  editor.addEventListener('click', function (e) {
    var day = e.target.closest('.admin-day');
    if (!day) return;
    if (e.target.matches('[data-add]')) {
      var row = slotRow('');
      e.target.parentNode.insertBefore(row, e.target);
      $('[data-from]', row).focus();
    } else if (e.target.matches('.admin-remove')) {
      e.target.parentNode.remove();
    } else return;
    updateClosed(day);
    dirty = true;
  });

  editor.addEventListener('input', function (e) {
    dirty = true;
    if (e.target.name === 'closure.active') toggleClosure();
    if (status.classList.contains('is-ok')) setStatus('');
  });

  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // --- Prüfen und Speichern ---------------------------------------------------

  function collect() {
    var errors = [];
    var hours = {};
    DAYS.forEach(function (d) {
      var slots = [];
      editor.querySelectorAll('[data-day="' + d[0] + '"] .admin-slot').forEach(function (row) {
        var from = $('[data-from]', row).value, to = $('[data-to]', row).value;
        if (!from && !to) return;
        if (!from || !to) errors.push(d[1] + ': Zeitfenster braucht Beginn und Ende.');
        else if (from >= to) errors.push(d[1] + ': ' + from + ' bis ' + to + ' – das Ende muss nach dem Beginn liegen.');
        else slots.push([from, to]);
      });
      slots.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
      for (var i = 1; i < slots.length; i++) {
        if (slots[i][0] < slots[i - 1][1]) errors.push(d[1] + ': Zeitfenster überschneiden sich.');
      }
      hours[d[0]] = slots.map(function (s) { return s[0] + '-' + s[1]; });
    });
    if (DAYS.every(function (d) { return !hours[d[0]].length; })) errors.push('Öffnungszeiten: an keinem Tag geöffnet.');

    var closure = {
      active: field('closure.active').checked,
      from: field('closure.from').value,
      to: field('closure.to').value,
      showDaysBefore: Math.max(0, parseInt(field('closure.showDaysBefore').value, 10) || 0),
      text: field('closure.text').value.trim()
    };
    if (closure.active) {
      if (!closure.from || !closure.to) errors.push('Betriebsferien: ersten und letzten Ferientag angeben.');
      else if (closure.from > closure.to) errors.push('Betriebsferien: der letzte Ferientag liegt vor dem ersten.');
      if (!closure.text) errors.push('Betriebsferien: Text für den Hinweisbalken fehlt.');
    }

    var season = {};
    ['winter', 'summer'].forEach(function (k) {
      var months = [];
      editor.querySelectorAll('[data-season="' + k + '"] [data-months] input:checked').forEach(function (i) { months.push(+i.value); });
      season[k] = { months: months, title: field('season.' + k + '.title').value.trim(), body: field('season.' + k + '.body').value.trim() };
      if (months.length && !season[k].title) errors.push('Reifensaison: Titel für ' + (k === 'winter' ? 'Winterreifen' : 'Sommerreifen') + ' fehlt.');
    });
    season.winter.months.forEach(function (m) {
      if (season.summer.months.indexOf(m) !== -1) errors.push('Reifensaison: ' + MONTHS[m - 1] + ' ist bei Winter und Sommer gewählt.');
    });

    var contact = {
      mobile: field('contact.mobile').value.trim(),
      landline: field('contact.landline').value.trim(),
      email: field('contact.email').value.trim()
    };
    if (!/^\+?[\d ]{9,}$/.test(contact.mobile)) errors.push('Kontakt: Telefon Mobile nur mit Ziffern und Leerzeichen, z.B. 079 681 64 68.');
    if (!/^\+?[\d ]{9,}$/.test(contact.landline)) errors.push('Kontakt: Telefon Festnetz nur mit Ziffern und Leerzeichen, z.B. 062 844 20 20.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) errors.push('Kontakt: E-Mail-Adresse prüfen.');

    // Gleiche Reihenfolge wie in content/site.json, damit die Änderungen im Verlauf lesbar bleiben
    return { errors: errors, data: { contact: contact, hours: hours, closure: closure, season: season } };
  }

  var saving = false;
  editor.addEventListener('submit', function (e) {
    e.preventDefault();
    if (saving) return;
    var result = collect();
    if (result.errors.length) {
      setStatus('Bitte korrigieren:\n' + result.errors.join('\n'), 'error');
      return;
    }
    saving = true;
    $('[data-save]').disabled = true;
    setStatus('Wird gespeichert …');
    api('/contents/' + FILE, {
      method: 'PUT',
      body: { message: 'Website-Daten aktualisiert', content: encode(JSON.stringify(result.data, null, 2) + '\n'), sha: sha, branch: BRANCH }
    }).then(function (res) {
      sha = res.content.sha;
      data = result.data;
      dirty = false;
      watchDeploy(res.commit.sha);
    }).catch(function (err) {
      if (err.status === 409) setStatus('Jemand anders hat inzwischen gespeichert. Seite neu laden und Änderungen nochmals machen.', 'error');
      else if (err.status === 401) loginError(err);
      else setStatus('Speichern fehlgeschlagen: ' + err.message, 'error');
    }).then(function () {
      saving = false;
      $('[data-save]').disabled = false;
    });
  });

  // Veröffentlichung verfolgen (braucht «Actions: Read» beim Schlüssel, sonst nur Hinweis)
  function watchDeploy(commit) {
    var site = { href: new URL('../', location.href).href, text: 'Website ansehen →' };
    var tries = 0;
    setStatus('Gespeichert. Wird veröffentlicht …');
    (function poll() {
      api('/actions/runs?head_sha=' + commit + '&per_page=1').then(function (res) {
        var run = res.workflow_runs && res.workflow_runs[0];
        if (run && run.status === 'completed') {
          if (run.conclusion === 'success') setStatus('Gespeichert und online.', 'ok', site);
          else setStatus('Gespeichert, aber das Veröffentlichen ist fehlgeschlagen. Die alte Version bleibt online.', 'error', { href: run.html_url, text: 'Details →' });
          return;
        }
        if (++tries > 60) { setStatus('Gespeichert. Das Veröffentlichen dauert länger als üblich.', 'ok', site); return; }
        setTimeout(poll, 5000);
      }).catch(function () {
        setStatus('Gespeichert. In etwa einer Minute online.', 'ok', site);
      });
    })();
  }

  // --- Start -----------------------------------------------------------------

  var saved = readToken();
  if (saved) signIn(saved).catch(loginError);
  else show('login');
})();
