# LebensmittelKumpel

Selbstgehostete Webapp zur Lebensmittelverwaltung der Familie: Lagerverwaltung
für Vorrat in Keller und Küche, Bestellvorschläge und Lieferungs-Check über den
Picnic-Lieferdienst sowie Verwaltung der Familienrezepte. Smartphone-optimiert
(PWA), mit Desktop-Ansicht.

## Funktionen

- **Anmeldung & Benutzer** — Login mit Benutzername + Passwort (scrypt-Hashing),
  Rollen Benutzer/Admin. Nur Admins verwalten Benutzer; jeder kann sein eigenes
  Passwort ändern. Alle Datensätze tragen anlegenden/ändernden Benutzer und
  Zeitstempel (Audit).
- **Lagerverwaltung** — Bestände in fünf Lagerorten (Küchenschrank, Kühlschrank,
  Gefrierschrank, Vorratsregal, Getränkekeller), geführt als Chargen mit eigenem
  MHD. Ein-/Ausbuchen per Barcode-Scan (FEFO beim Ausbuchen), MHD-Ampel und
  „Läuft bald ab"-Ansicht. Schnelle +/−-Korrektur direkt in der Artikelliste.
- **Artikelstamm** — Name, Bild, Gebindegröße mit Maßeinheit, EAN, optionale
  Picnic-Artikel-ID, Mindestbestand und Standard-Lagerort. Neuanlage per
  Barcode-Scan, Vorbefüllung über Open Food Facts und Picnic-Produktsuche.
- **Bestellvorschläge** — Artikel unter Mindestbestand landen auf der
  Vorschlagsliste und wandern nach Bestätigung in den Picnic-Warenkorb
  ([picnic-api](https://github.com/MRVDH/picnic-api), inoffiziell). Bestellt
  wird bewusst nie automatisch — der Checkout bleibt in der Picnic-App.
- **Lieferungs-Check** — Beim Auspacken einer Picnic-Lieferung: Positionen per
  Barcode scannen (matcht über die Picnic-ID) und direkt in den Ziel-Lagerort
  einbuchen, oder nach Sichtprüfung alle offenen Positionen auf einmal
  bestätigen. Zeigt Produktbilder aus Picnic.
- **Rezepte** — warme Mahlzeiten und Kuchen, Zutaten verknüpft mit dem
  Artikelstamm oder als Freitext, freie Tags. Kochbarkeits-Check gegen den
  Bestand („Was kann ich heute kochen?"), Portionsskalierung und „Fehlende
  Zutaten in den Picnic-Warenkorb" (aufgerundet auf Gebindegrößen). Zufälliger
  Rezeptvorschlag mit 2-Wochen-Sperre für kürzlich Gekochtes, optional nach Tags.

## Stack

SvelteKit (adapter-node) · TypeScript · SQLite (better-sqlite3 + Drizzle ORM) ·
Tailwind CSS · PWA · Docker (amd64 + arm64)

## Entwicklung

Voraussetzung: **Node.js ≥ 22.12** (Vite 8).

```sh
cp .env.example .env      # Werte anpassen (siehe unten)
npm install
npm run dev
```

Die SQLite-Datenbank (`local.db`) wird beim ersten Start automatisch angelegt
und migriert. Fehlt ein Benutzer, wird aus `ADMIN_USERNAME`/`ADMIN_PASSWORD` ein
Admin angelegt — ohne diese Variablen kommt man nicht in die App.

Nützliche Skripte:

| Befehl               | Zweck                                               |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Dev-Server (Port 5173)                              |
| `npm run build`      | Produktions-Build (adapter-node)                    |
| `npm run check`      | Typecheck (`svelte-check`)                          |
| `npm run db:generate`| Migration aus dem Schema erzeugen (nach Schema-Änderung) |

## Betrieb mit Docker

```sh
docker compose up -d                              # lokal bauen
# oder produktiv das fertige GHCR-Image:
docker compose -f docker-compose.prod.yml up -d
```

Die App läuft auf Port 3000; alle persistenten Daten (Datenbank, Bilder,
Picnic-Auth-Key) liegen im Volume `./data`. Migrationen und der Lagerort-/Admin-
Seed laufen beim Containerstart automatisch. Images werden per GitHub Actions
für amd64 und arm64 nach GHCR veröffentlicht:
`ghcr.io/sirtobyb/lebensmittelkumpel:latest`. `docker-compose.prod.yml` enthält
Traefik-Labels (externes Netzwerk `proxy`, websecure, Certresolver `tls_resolver`).

### Erste Picnic-Verbindung

Beim ersten Öffnen von **Bestellen** einmal mit Picnic verbinden (Login + SMS-2FA).
Der Auth-Key wird im Volume abgelegt und übersteht Neustarts; danach fällt 2FA
nur noch selten an. Ohne Verbindung funktionieren Bestellvorschläge, Lieferungs-
Check und Rezept-Warenkorb nicht.

### Umgebungsvariablen

| Variable          | Beschreibung                                            | Default (Container)           |
| ----------------- | ------------------------------------------------------- | ----------------------------- |
| `DATABASE_URL`    | Pfad zur SQLite-Datei                                   | `/data/lebensmittelkumpel.db` |
| `DATA_DIR`        | Verzeichnis für Bilder und Picnic-Auth-Key             | `/data`                       |
| `ORIGIN`          | Öffentliche URL der App (CSRF-Schutz von adapter-node) | —                             |
| `ADMIN_USERNAME`  | Erster Admin (nur beim Erststart ohne Benutzer)        | —                             |
| `ADMIN_PASSWORD`  | Passwort des ersten Admins                             | —                             |
| `ADMIN_EMAIL`     | E-Mail des ersten Admins (optional)                    | —                             |
| `PICNIC_USERNAME` | Picnic-Zugangsdaten für Warenkorb, Lieferungen, Suche  | —                             |
| `PICNIC_PASSWORD` |                                                        | —                             |
| `BODY_SIZE_LIMIT` | Max. Request-Größe (Foto-Uploads!)                     | `15M`                         |

> **Passwörter mit Sonderzeichen** (`#`, `$` …) in `.env` und in der
> `docker-compose*.yml` immer in Anführungszeichen setzen — ein unquotiertes `#`
> wird sonst als Kommentar abgeschnitten.
