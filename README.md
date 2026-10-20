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

Unter <https://www.garage-morina.ch/admin/> gibt es ein eigenes Formular im Stil der Website (`admin/index.html`, `admin/admin.js`, `admin/admin.css`, ohne Abhängigkeiten) für:

- Öffnungszeiten pro Tag
- Betriebsferien: Hinweisbalken auf allen Seiten, Status «geöffnet/geschlossen» stellt auf Ferien um
- Reifensaison: Monate und Text des Hinweises
- Telefon Mobile/Festnetz und E-Mail

Das Formular liest und speichert `content/site.json` direkt über die GitHub-API; Speichern erzeugt einen Commit auf `main`. Danach überträgt der Workflow `.github/workflows/deploy.yml` die Werte mit `scripts/apply-content.mjs` in alle Seiten und veröffentlicht sie. Nach etwa einer Minute ist die Änderung live, das Formular zeigt das an. Ungültige Eingaben fängt schon das Formular ab; falls doch etwas durchrutscht (z.B. `25:00-12:00`), schlägt der Workflow fehl und die alte Version bleibt online.

In den HTML-Dateien markieren `data-cms="…"`, `data-cms-href="…"` und `data-cms-content="…"` die Stellen, die das Skript ersetzt. Für den Live-Status erzeugt es zusätzlich `assets/js/content.js`. Nach einer Änderung an `content/site.json` lokal ausführen und mitcommitten:

```sh
node scripts/apply-content.mjs           # Seiten aktualisieren
node scripts/apply-content.mjs --check   # nur prüfen, ob etwas veraltet ist
```

### Anmeldung

Wer bearbeiten will, braucht ein GitHub-Konto mit Schreibrecht auf dieses Repository und einmalig einen Zugangsschlüssel (Fine-grained Personal Access Token). Die Anmeldeseite unter `/admin` verlinkt auf GitHub mit vorausgefüllten Feldern (Besitzer Code-Schmiede-GmbH, *Contents: Read and write*, *Actions: Read*, 1 Jahr gültig). Dort nur noch bei *Repository access* `garage-morina` auswählen und den Schlüssel erzeugen. Der Browser speichert ihn lokal; «Abmelden» löscht ihn.

Falls Code-Schmiede-GmbH beim Erstellen nicht als Besitzer erscheint: In den Organisationseinstellungen unter *Personal access tokens* Fine-grained Tokens erlauben.

Ein Knopf «Mit GitHub anmelden» würde einen kleinen Server brauchen (z.B. einen Cloudflare Worker), weil GitHub dafür ein Client-Secret verlangt, das nicht im Browser liegen darf.
