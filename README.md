# Garage Morina – Website

Statische Website für die Garage Morina GmbH, Aarau. Reines HTML/CSS/JS ohne Build-Schritt, gedacht für GitHub Pages.

## Struktur

| Datei | Inhalt |
|---|---|
| `index.html` | Startseite: Hero mit Anruf-/Termin-Buttons, Live-Status «geöffnet/geschlossen», Saisonleistungen, Über mich, Standort |
| `angebot.html` | Alle Leistungen, gruppiert in 6 Kategorien |
| `kontakt.html` | Kontaktdaten, Öffnungszeiten, Terminanfrage-Formular, Karte (lädt erst nach Klick) |
| `impressum.html`, `datenschutz.html` | Rechtliche Seiten (DSG) |
| `404.html` | Fehlerseite |
| `angebot/`, `kontakt/`, `news/` | Weiterleitungen von den alten WordPress-URLs |
| `assets/` | CSS, JS, Bilder (WebP, von ~29 MB auf ~0.8 MB komprimiert) |

Header und Footer sind in jeder HTML-Datei enthalten. Öffnungszeiten, Telefonnummern, E-Mail, Betriebsferien und Reifensaison kommen aus `content/site.json` (siehe unten); alle anderen Texte direkt in den HTML-Dateien ändern.

## Website-Daten bearbeiten (`/admin`)

Unter <https://www.garage-morina.ch/admin/> gibt es ein Formular ([Sveltia CMS](https://github.com/sveltia/sveltia-cms)) für:

- Öffnungszeiten pro Tag
- Betriebsferien: Hinweisbalken auf allen Seiten, Status «geöffnet/geschlossen» stellt auf Ferien um
- Reifensaison: Monate und Text des Hinweises
- Telefon Mobile/Festnetz und E-Mail

Speichern erzeugt einen Commit auf `main`, der die Datei `content/site.json` ändert. Danach überträgt der Workflow `.github/workflows/deploy.yml` die Werte mit `scripts/apply-content.mjs` in alle Seiten und veröffentlicht sie. Nach etwa einer Minute ist die Änderung live. Ungültige Eingaben (z.B. `25:00-12:00`) lassen den Workflow fehlschlagen, die alte Version bleibt dann online.

In den HTML-Dateien markieren `data-cms="…"`, `data-cms-href="…"` und `data-cms-content="…"` die Stellen, die das Skript ersetzt. Für den Live-Status erzeugt es zusätzlich `assets/js/content.js`. Nach einer Änderung an `content/site.json` lokal ausführen und mitcommitten:

```sh
node scripts/apply-content.mjs           # Seiten aktualisieren
node scripts/apply-content.mjs --check   # nur prüfen, ob etwas veraltet ist
```

### Anmeldung einrichten

Wer bearbeiten will, braucht ein GitHub-Konto mit Schreibrecht auf dieses Repository.

- **Einfach (ohne Einrichtung):** Auf `/admin` «Sign In with Token» wählen und ein [Fine-grained Personal Access Token](https://github.com/settings/personal-access-tokens/new) eingeben: nur dieses Repository, Berechtigung *Contents: Read and write*. Das Token bleibt im Browser gespeichert.
- **Komfortabel («Mit GitHub anmelden»):** Den Worker [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) kostenlos bei Cloudflare deployen, eine GitHub OAuth App mit Callback-URL `https://<worker>/callback` anlegen, Client-ID/Secret im Worker hinterlegen und die Worker-URL in `admin/config.yml` bei `base_url` eintragen.

## Vor dem Livegang ausfüllen

- [ ] **Impressum:** UID (`CHE-…`) eintragen, siehe [zefix.ch](https://www.zefix.ch). MWST-Nummer eintragen oder Abschnitt löschen. Funktion von Fetah Morina (Geschäftsführer/Gesellschafter) prüfen.
- [ ] Texte gegenlesen lassen, besonders die Kurzbeschreibungen der Leistungen auf `angebot.html`.
- [ ] Optional: Preise ergänzen (z.B. «Reifenwechsel ab CHF …»).

## Lokal ansehen

```sh
python -m http.server 8000
```

Dann <http://localhost:8000> öffnen.

## Veröffentlichen auf GitHub Pages

1. Neues Repository auf GitHub anlegen und diesen Ordner pushen.
2. *Settings → Pages → Source:* «GitHub Actions». Der Workflow `.github/workflows/deploy.yml` veröffentlicht bei jedem Push auf `main` (ohne `scripts/`, `content/`, `.github/`).
3. Eigene Domain:
   - *Settings → Pages → Custom domain:* `www.garage-morina.ch` eintragen (bei «GitHub Actions» ist keine `CNAME`-Datei nötig).
   - Beim Domain-Anbieter DNS setzen:
     - `www` → `CNAME` auf `<github-benutzer>.github.io`
     - `garage-morina.ch` (Apex) → `A`-Records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - Sobald das Zertifikat bereit ist, **«Enforce HTTPS»** aktivieren.
4. **E-Mail nicht kaputt machen:** Beim DNS-Umzug nur die `A`-/`CNAME`-Einträge der Website ändern. Die `MX`-Einträge für `info@garage-morina.ch` bleiben unverändert.

Hinweis: Die `404.html` nutzt absolute Pfade (`/assets/…`) und funktioniert deshalb erst mit eigener Domain korrekt, nicht unter `benutzer.github.io/repo/`. Alle anderen Seiten funktionieren überall.

## Terminformular

GitHub Pages hat kein Backend. Das Formular öffnet deshalb eine fertig ausgefüllte E-Mail im Mailprogramm des Besuchers (`mailto:`). Dabei gehen keine Daten an Dritte. Soll das Formular direkt senden, kann ein Dienst wie Formspree oder Web3Forms eingebunden werden. Dann muss die Datenschutzerklärung (Abschnitt 3) angepasst werden.

## Nach dem Livegang

- Google Business Profile beanspruchen und pflegen (Öffnungszeiten, Fotos, Leistungen), Kunden um Bewertungen bitten.
- In der Google Search Console die `sitemap.xml` einreichen.
- Feiertags-Schliessungen kommunizieren (Hinweisbalken in `index.html`, `data-season-notice`, kann dafür angepasst werden).
