// Überträgt content/site.json (bearbeitbar unter /admin) in die HTML-Seiten
// und erzeugt assets/js/content.js für den Live-Status und die Hinweisbalken.
//
//   node scripts/apply-content.mjs           schreibt die Dateien
//   node scripts/apply-content.mjs --check   meldet nur, ob etwas veraltet ist
//
// In den Seiten markieren Attribute, was ersetzt wird:
//   data-cms="key"          Inhalt des Elements (bei <a> auch href)
//   data-cms-href="key"     nur href, z.B. Anruf-Buttons mit Icon
//   data-cms-content="key"  content-Attribut von <meta>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

// Reihenfolge Mo–So, mit der Tagesnummer aus JavaScript (0 = Sonntag)
const DAYS = [
  { key: 'mon', js: 1, short: 'Mo', long: 'Montag', schema: 'Monday' },
  { key: 'tue', js: 2, short: 'Di', long: 'Dienstag', schema: 'Tuesday' },
  { key: 'wed', js: 3, short: 'Mi', long: 'Mittwoch', schema: 'Wednesday' },
  { key: 'thu', js: 4, short: 'Do', long: 'Donnerstag', schema: 'Thursday' },
  { key: 'fri', js: 5, short: 'Fr', long: 'Freitag', schema: 'Friday' },
  { key: 'sat', js: 6, short: 'Sa', long: 'Samstag', schema: 'Saturday' },
  { key: 'sun', js: 0, short: 'So', long: 'Sonntag', schema: 'Sunday' }
];

// --- Einlesen und prüfen ---------------------------------------------------

const errors = [];
const fail = (msg) => errors.push(msg);

const data = JSON.parse(readFileSync(join(ROOT, 'content/site.json'), 'utf8'));

const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const hours = {};
for (const d of DAYS) {
  const raw = data.hours?.[d.key] ?? [];
  if (!Array.isArray(raw)) { fail(`hours.${d.key} muss eine Liste sein`); continue; }
  const slots = [];
  for (const s of raw) {
    const m = /^\s*(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\s*$/.exec(String(s));
    if (!m || +m[1] > 24 || +m[2] > 59 || +m[3] > 24 || +m[4] > 59) {
      fail(`hours.${d.key}: «${s}» ist keine Zeit wie 08:00-12:00`);
      continue;
    }
    const from = `${m[1].padStart(2, '0')}:${m[2]}`, to = `${m[3].padStart(2, '0')}:${m[4]}`;
    if (toMinutes(from) >= toMinutes(to)) fail(`hours.${d.key}: «${s}» endet nicht nach dem Beginn`);
    slots.push([from, to]);
  }
  slots.sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
  for (let i = 1; i < slots.length; i++) {
    if (toMinutes(slots[i][0]) < toMinutes(slots[i - 1][1])) fail(`hours.${d.key}: Zeitfenster überschneiden sich`);
  }
  hours[d.key] = slots;
}
if (DAYS.every((d) => !hours[d.key]?.length)) fail('hours: an keinem Tag geöffnet');

const contact = data.contact ?? {};
for (const k of ['mobile', 'landline']) {
  if (!/^\+?[\d ]{9,}$/.test(contact[k] ?? '')) fail(`contact.${k}: «${contact[k]}» ist keine Telefonnummer`);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email ?? '')) fail(`contact.email: «${contact.email}» ist keine E-Mail-Adresse`);

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && new Date(s + 'T00:00Z').toISOString().startsWith(s);
const closure = data.closure ?? {};
if (closure.active) {
  if (!isDate(closure.from)) fail(`closure.from: «${closure.from}» ist kein Datum`);
  if (!isDate(closure.to)) fail(`closure.to: «${closure.to}» ist kein Datum`);
  if (closure.from > closure.to) fail('closure: «Bis» liegt vor «Von»');
  if (!String(closure.text ?? '').trim()) fail('closure.text fehlt');
}
const showDaysBefore = Number.isInteger(closure.showDaysBefore) && closure.showDaysBefore >= 0 ? closure.showDaysBefore : 14;

const season = data.season ?? {};
const seenMonths = new Set();
for (const k of ['winter', 'summer']) {
  const s = season[k] ?? {};
  const months = (s.months ?? []).map(Number);
  for (const m of months) {
    if (!Number.isInteger(m) || m < 1 || m > 12) fail(`season.${k}.months: «${m}» ist kein Monat`);
    if (seenMonths.has(m)) fail(`season: Monat ${m} ist bei Winter und Sommer gewählt`);
    seenMonths.add(m);
  }
  if (months.length && !String(s.title ?? '').trim()) fail(`season.${k}.title fehlt`);
}

if (errors.length) {
  console.error('content/site.json enthält Fehler:\n- ' + errors.join('\n- '));
  process.exit(1);
}

// --- Darstellungen ---------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tel = (n) => 'tel:' + (n.trim().startsWith('+') ? '+' : '+41') + n.replace(/\D/g, '').replace(/^0/, '');
const sameSlots = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const range = (slot, sep) => slot[0] + sep + slot[1];

// Aufeinanderfolgende Tage mit gleichen Zeiten zusammenfassen (Mo–Fr, Sa, So)
function groups() {
  const out = [];
  for (const d of DAYS) {
    const last = out[out.length - 1];
    if (last && sameSlots(last.slots, hours[d.key])) last.days.push(d);
    else out.push({ days: [d], slots: hours[d.key] });
  }
  return out;
}
const open = () => groups().filter((g) => g.slots.length);
const label = (g, key, sep) => g.days.length === 1 ? g.days[0][key] : g.days[0][key] + sep + g.days[g.days.length - 1][key];

// Mo–Fr 08:00–12:00 / 13:30–18:00 · Sa 08:00–12:00
const hoursShort = () => open().map((g) => label(g, 'short', '–') + ' ' + g.slots.map((s) => range(s, '–')).join(' / ')).join(' · ');
// Mo–Fr 08:00–12:00 und 13:30–18:00, Sa 08:00–12:00
const hoursProse = () => open().map((g) => label(g, 'short', '–') + ' ' + g.slots.map((s) => range(s, '–')).join(' und ')).join(', ');

const RENDER = {
  'hours-short': () => hoursShort(),
  'hours-footer': () => open().map((g) => label(g, 'short', '–') + ' ' + g.slots.map((s) => range(s, '–')).join('<br>')).join('<br>'),
  'hours-table': (inner, indent) => groups().map((g) =>
    `\n${indent}  <tr data-days="${g.days.map((d) => d.js).join(',')}"><th scope="row">${label(g, 'long', ' – ')}</th>` +
    `<td>${g.slots.length ? g.slots.map((s) => range(s, ' – ')).join('<br>') : 'geschlossen'}</td></tr>`
  ).join('') + `\n${indent}`,
  'phone-mobile': () => esc(contact.mobile),
  'phone-landline': () => esc(contact.landline),
  'email': () => esc(contact.email),
  // Nur die bearbeitbaren Felder im JSON-LD ersetzen, den Rest unverändert lassen
  'jsonld': (inner) => {
    const spec = open().flatMap((g) => g.slots.map((s) => {
      const days = g.days.length === 1 ? `"${g.days[0].schema}"` : '[' + g.days.map((d) => `"${d.schema}"`).join(',') + ']';
      return `      { "@type": "OpeningHoursSpecification", "dayOfWeek": ${days}, "opens": "${s[0]}", "closes": "${s[1]}" }`;
    })).join(',\n');
    return inner
      .replace(/"telephone": "[^"]*"/, `"telephone": "${tel(contact.mobile).slice(4)}"`)
      .replace(/"email": "[^"]*"/, `"email": "${contact.email}"`)
      .replace(/"openingHoursSpecification": \[[\s\S]*?\n    \]/, `"openingHoursSpecification": [\n${spec}\n    ]`);
  }
};
const HREF = {
  'phone-mobile': () => tel(contact.mobile),
  'phone-landline': () => tel(contact.landline),
  'email': () => 'mailto:' + contact.email
};
const CONTENT = {
  'kontakt-desc': () => esc(`Garage Morina GmbH, Weihermattstrasse 96, 5000 Aarau. Telefon ${contact.mobile}. Öffnungszeiten ${hoursProse()}. Jetzt Termin anfragen.`)
};

function unknown(file, key) {
  console.error(`${file}: unbekannter Schlüssel «${key}»`);
  process.exit(1);
}

function apply(file, html) {
  const setHref = (attrs, key) => HREF[key] ? attrs.replace(/(\s)href="[^"]*"/, `$1href="${HREF[key]()}"`) : attrs;

  html = html.replace(/(^[ \t]*)?<(\w+)\b([^>]*\bdata-cms="([\w-]+)"[^>]*)>([\s\S]*?)<\/\2>/gm, (all, indent = '', tag, attrs, key, inner) => {
    if (!RENDER[key]) unknown(file, key);
    return `${indent}<${tag}${setHref(attrs, key)}>${RENDER[key](inner, indent)}</${tag}>`;
  });
  html = html.replace(/<a\b([^>]*\bdata-cms-href="([\w-]+)"[^>]*)>/g, (all, attrs, key) => {
    if (!HREF[key]) unknown(file, key);
    return `<a${setHref(attrs, key)}>`;
  });
  html = html.replace(/<meta\b([^>]*\bdata-cms-content="([\w-]+)"[^>]*)>/g, (all, attrs, key) => {
    if (!CONTENT[key]) unknown(file, key);
    return `<meta${attrs.replace(/(\s)content="[^"]*"/, `$1content="${CONTENT[key]()}"`)}>`;
  });
  return html;
}

// --- Schreiben -------------------------------------------------------------

const runtime = {
  contact: { email: contact.email },
  hours: Object.fromEntries(DAYS.filter((d) => hours[d.key].length).map((d) => [d.js, hours[d.key].map((s) => s.map(toMinutes))])),
  closure: closure.active ? { from: closure.from, to: closure.to, showDaysBefore, text: closure.text.trim() } : null,
  season: Object.fromEntries(['winter', 'summer'].map((k) => [k, {
    months: (season[k]?.months ?? []).map(Number),
    title: String(season[k]?.title ?? '').trim(),
    body: String(season[k]?.body ?? '').trim()
  }]))
};

const outputs = new Map();
for (const name of readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  const path = join(ROOT, name);
  outputs.set(path, apply(name, readFileSync(path, 'utf8').replace(/\r\n/g, '\n')));
}
outputs.set(join(ROOT, 'assets/js/content.js'),
  '// Automatisch erzeugt aus content/site.json von scripts/apply-content.mjs. Nicht von Hand ändern.\n' +
  // Zahlenlisten auf eine Zeile: "1": [[480,720],[810,1080]]
  'window.GM_CONTENT = ' + JSON.stringify(runtime, (k, v) => Array.isArray(v) ? JSON.stringify(v) : v, 2)
    .replace(/"(\[[\d,[\]]*\])"/g, '$1') + ';\n');

let stale = 0;
for (const [path, lf] of outputs) {
  let before = '';
  try { before = readFileSync(path, 'utf8'); } catch {}
  // Unter Windows checkt Git mit CRLF aus; das bestehende Zeilenende beibehalten
  const text = before.includes('\r\n') ? lf.replace(/\n/g, '\r\n') : lf;
  if (before === text) continue;
  stale++;
  console.log((CHECK ? 'veraltet: ' : 'aktualisiert: ') + path.slice(ROOT.length + 1).replace(/\\/g, '/'));
  if (!CHECK) writeFileSync(path, text);
}
if (CHECK && stale) process.exit(1);
if (!stale) console.log('Alles aktuell.');
