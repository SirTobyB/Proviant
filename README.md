# LebensmittelKumpel

Selbstgehostete Webapp zur Lebensmittelverwaltung der Familie: Lagerverwaltung
für Vorrat in Keller und Küche, Bestellvorschläge über den Picnic-Lieferdienst
und Verwaltung der Familienrezepte. Smartphone-optimiert (PWA), mit Desktop-Ansicht.

## Funktionen (geplant / in Arbeit)

- **Lagerverwaltung** — Bestände in vier Lagerorten (Küchenschrank, Kühlschrank,
  Gefrierschrank, Vorratsregal), geführt als Chargen mit eigenem MHD.
  Ein-/Ausbuchen per Barcode-Scan mit der Smartphone-Kamera, „Läuft bald ab“-Ansicht.
- **Artikelstamm** — Name, Bild, Gebindegröße mit Maßeinheit, EAN und
  Picnic-Artikel-ID. Neuanlage per Barcode-Scan, Vorbefüllung über
  Open Food Facts und Picnic-Produktsuche.
- **Bestellvorschläge** — Artikel unter Mindestbestand landen auf der
  Vorschlagsliste und wandern nach Bestätigung in den Picnic-Warenkorb
  ([picnic-api](https://github.com/MRVDH/picnic-api), inoffiziell).
  Bestellt wird bewusst nie automatisch — der Checkout bleibt in der Picnic-App.
- **Rezepte** — warme Mahlzeiten und Kuchen, Zutaten verknüpft mit dem
  Artikelstamm. „Zutaten in den Picnic-Warenkorb“ rundet auf Gebindegrößen auf;
  der Überschuss wandert ins Lager.

## Stack

SvelteKit (adapter-node) · TypeScript · SQLite (better-sqlite3 + Drizzle) ·
Tailwind CSS · PWA · Docker (amd64 + arm64)

## Entwicklung

Voraussetzung: Node.js ≥ 22.12

```sh
cp .env.example .env
npm install
npm run dev
```

Die SQLite-Datenbank (`local.db`) wird beim ersten Start automatisch angelegt
und migriert (Migrationen liegen in `drizzle/`, erzeugt via `npm run db:generate`).

## Betrieb mit Docker

```sh
docker compose up -d
```

Die App läuft auf Port 3000, alle persistenten Daten (Datenbank, Bilder,
Picnic-Auth-Key) liegen im Volume `./data`. Fertige Images werden per
GitHub Actions für amd64 und arm64 nach GHCR veröffentlicht:
`ghcr.io/sirtobyb/lebensmittelkumpel:latest`

### Umgebungsvariablen

| Variable          | Beschreibung                                            | Default (Container)        |
| ----------------- | ------------------------------------------------------- | -------------------------- |
| `DATABASE_URL`    | Pfad zur SQLite-Datei                                   | `/data/lebensmittelkumpel.db` |
| `DATA_DIR`        | Verzeichnis für Bilder und Picnic-Auth-Key              | `/data`                    |
| `ORIGIN`          | Öffentliche URL der App (CSRF-Schutz von adapter-node)  | —                          |
| `PICNIC_USERNAME` | Picnic-Zugangsdaten für Warenkorb und Produktsuche      | —                          |
| `PICNIC_PASSWORD` |                                                         | —                          |
