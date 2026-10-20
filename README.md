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

Header und Footer sind in jeder HTML-Datei enthalten. Bei Änderungen (z.B. Telefonnummer, Öffnungszeiten) in allen Dateien anpassen. Die Öffnungszeiten stehen zusätzlich in `assets/js/main.js` (`HOURS`, für den Live-Status) und im JSON-LD in `index.html`.

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
2. *Settings → Pages → Source:* «Deploy from a branch», Branch `main`, Ordner `/ (root)`.
3. Eigene Domain:
   - *Settings → Pages → Custom domain:* `www.garage-morina.ch` eintragen (GitHub legt dabei eine `CNAME`-Datei an).
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
