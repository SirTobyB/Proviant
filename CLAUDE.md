# CLAUDE.md

Leitfaden für die Arbeit an diesem Repository (Claude Code & Mitentwickelnde).

## Projekt

Selbstgehostete Familien-Webapp zur Lebensmittelverwaltung: Lager (Chargen mit
MHD), Inventur, Artikelstamm (mit Tags), Rezepte (mit Alternativartikeln je
Zutat), Wochenplan und Picnic-Anbindung (Bestellvorschläge — abgeglichen mit
Warenkorb und offenen Bestellungen —, Lieferungs-Check mit Auto-Anlage
fehlender Artikel). SvelteKit + TypeScript + SQLite (Drizzle), als
Docker-Image für amd64/arm64. UI, Kommentare und Commit-Messages sind
**deutsch**.

## Befehle

```sh
npm run dev           # Dev-Server auf Port 5173
npm run build         # Produktions-Build (adapter-node)
npm run check         # Typecheck – nach Änderungen immer laufen lassen
npm test              # Vitest (reine Logik-Module), npm run test:watch zum Mitlaufen
npm run db:generate   # Migration aus dem Schema erzeugen (nach Schema-Änderung)
```

Voraussetzung: **Node.js ≥ 22.12** (Vite 8). Verifikation vor dem Commit:
`npm run check` + `npm test` + `npm run build`; für UI-Änderungen den
Dev-Server starten und im Browser prüfen.

**Tests** (`vitest.config.ts`, bewusst ohne SvelteKit-Plugin) decken die
reinen Logik-Module ab: `units.ts`, `suggest.ts`, `mhd.ts`, `format.ts`,
`picnic/unitQuantity.ts`, `picnic/checklist.ts`. Genau dort steckten die
schwersten Bugs — neue Rechenlogik gehört deshalb in ein solches Modul
**mit Test**, nicht in eine Route.

## Architektur

- **Routen** unter `src/routes/`. Server-Logik in `+page.server.ts` (Actions),
  UI in `+page.svelte`. JSON-Endpunkte unter `src/routes/api/`.
- **Serverseitige Module** in `src/lib/server/`:
  - `db/` – Drizzle-Setup und Schema. `db/index.ts` **wendet beim Start
    Migrationen an** (`migrate`) und seedet Lagerorte + ersten Admin idempotent.
  - `picnic/` – **isolierter Adapter** um die inoffizielle `picnic-api`. Der
    Rest der App importiert Picnic **nur von hier**. Reine, eigenständig
    testbare Untermodule (ohne SvelteKit-Import): `checklist.ts`
    (Lieferdaten-Normalisierung), `recipeImport.ts` (Parser für die
    undokumentierten PML-/Fusion-Rezeptseiten), `unitQuantity.ts`
    (Gebindegrößen wie „6er Pack", „2 x 125g").
  - `auth.ts` / `password.ts` – Sessions (DB-gestützt, httpOnly-Cookie) und
    scrypt-Hashing. `audit.ts` – Helfer für die Audit-Felder.
  - `stock.ts` (Buchungen, FEFO), `tags.ts` (Rezept-Tags), `articleTags.ts`
    (Artikel-Tags — **eigener Tag-Pool**, bewusst getrennt von den
    Rezept-`tags`, inkl. Bulk-Map `tagsForArticles` gegen N+1 auf
    Listenseiten), `recipeData.ts`, `mealPlan.ts` (Wochenplan-Einkaufsliste:
    verrechnet den gemeinsamen Vorrat über alle geplanten Tage per
    Artikel-Pool, Rundungs-Überschüsse werden zurückgebucht),
    `articleForm.ts`, `recipeForm.ts`, `articleImport.ts` (Artikel aus
    Picnic-Produkt, **idempotent** per picnicId-Dedupe — wird auch vom
    Lieferungs-Check zum Auto-Anlegen fehlender Artikel genutzt), `images.ts`.
- **Reine Helfer** in `src/lib/` (client- und servertauglich): `units.ts`
  (Mengen/Einheiten; `coverageMulti` summiert Bestand über die
  Alternativartikel einer Zutat), `mhd.ts` (Restlaufzeit/Ampel), `suggest.ts`
  (gewichteter Rezeptvorschlag), `sound.ts` (Scan-Signalton per Web Audio),
  `format.ts` (`packageSize`, `formatPrice`, `tagFilterHref` — vor eigenen
  Formatierern erst hier nachsehen), `stock.ts` (`sumQuantity`), `forms.ts`
  (`keepValues`, siehe Formular-Fallstrick unten).
- **Wiederverwendbare Komponenten** in `src/lib/components/`: `ArticleForm`,
  `RecipeForm`, `TagInput` (Chips + Autocomplete, rendert das
  `name="tags"`-Hiddenfield selbst), `BarcodeScanner`, `StockEntryRow`
  (Chargen-Zeile mit Schnellkorrektur/Bearbeiten/Umlagern — genutzt von der
  Lagerort- **und** der Artikelseite; die Server-Logik dazu liegt in
  `server/stock.ts` als `updateStockEntryFromForm`/`moveStockEntryFromForm`,
  parametrisiert über `{ articleId }` oder `{ locationId }`).
- **Auth-Enforcement** in `src/hooks.server.ts`: ohne Login → `/login`;
  `/benutzer` nur für Admins. `locals.user` (Typ in `src/app.d.ts`) trägt den
  angemeldeten Benutzer. Das Root-Layout zeigt die Navigation nur, wenn
  `data.user` gesetzt ist (deshalb rendert `/login` ohne App-Chrome).

## Wichtige Konventionen & Fallstricke

- **Audit-Felder:** Jede Tabelle hat `created_by/updated_by/created_at/updated_at`
  (Link-Tabelle nur Anlage). Bei **jedem** Insert/Update die Helfer aus
  `audit.ts` einspreizen und `locals.user?.username` durchreichen
  (`auditNew` / `auditEdit` / `auditLink`). Serverfunktionen wie `bookIn`,
  `bookOut`, `setRecipeTags` nehmen den Benutzernamen als Parameter.
- **Migrationen:** Nach Schema-Änderung `npm run db:generate`. SQLite erlaubt bei
  `ALTER TABLE ADD COLUMN` **keinen nicht-konstanten Default** (`unixepoch()`) —
  für nachgerüstete Zeitstempel-Spalten die generierte Migration von Hand auf
  `DEFAULT 0 NOT NULL` + `UPDATE … = unixepoch()` (Backfill) umstellen (siehe
  `drizzle/0002_*.sql`). Das Schema behält `default(sql\`(unixepoch())\`)`; da der
  Snapshot dem Schema entspricht, entsteht keine Drift.
- **Lagerorte / Admin** werden beim Start geseedet (idempotent). Ein neuer
  Lagerort wird einfach der Liste in `db/index.ts` hinzugefügt und kommt beim
  nächsten Start dazu — keine Migration nötig.
- **Picnic:** Nur Warenkorb befüllen, **nie automatisch bestellen** — der
  Checkout bleibt in der Picnic-App. Erststart braucht Login + SMS-2FA; der
  Auth-Key liegt in `DATA_DIR/picnic-auth-key` (übersteht Neustarts).
  Grenzen der API (live geprüft): Suche findet **keine EANs**, Produktdetails
  enthalten **keine EAN/GTIN**, Rezept**bilder** sind nicht öffentlich abrufbar
  (S3 403) — Produktbilder dagegen schon. Die Rezept-/Übersichtsseiten sind
  dynamische PML-Strukturen; Parser dafür heuristisch und **defensiv** halten
  (lieber leer zurückgeben als Datenmüll importieren).
- **Picnic-Datenstrukturen** (alle live geprüft, sparen viel Rätselraten):
  - **Mengen stehen im `QUANTITY`-Decorator**, nie in der Länge von `items`:
    ein Produkt taucht je Zeile genau **einmal** auf. Vorkommen zählen ergibt
    also immer 1 — genau dieser Fehler steckte im ersten Warenkorb-Abgleich.
    `lineQuantity()` in `picnic/checklist.ts` macht es richtig.
  - **Warenkorb:** `analytics_context_data.items_list` (`product_id` +
    `quantity`) ist die bequemste Quelle, fehlt aber bei leerem Warenkorb —
    deshalb zusätzlich der Decorator-Weg als Fallback (`getCartQuantities`).
  - **Lieferungsliste enthält keine Positionen** (`orders[].items` fehlt), die
    kommen erst per `getDelivery(id)`. Offene Lieferungen deshalb per
    Ausschluss bestimmen (nicht `COMPLETED`/`CANCELLED`) und je Lieferung
    einzeln nachladen; auch Teilbestellungen können `CANCELLED` sein.
  - **Unbekannte Produkt-IDs quittiert Picnic ohne Fehler** — es landet
    nichts im Warenkorb, die App meldete trotzdem Erfolg. Nach dem Befüllen
    deshalb gegenprüfen (siehe `notInCart` auf der Bestellseite). Dasselbe
    Produkt existiert im Katalog teils unter mehreren IDs.
- **Dark Theme:** implementiert als gezielte Utility-Overrides in
  `src/routes/layout.css` unter `prefers-color-scheme: dark` (bewusst **nicht**
  die `--color-*`-Variablen global umbiegen — `text-white` auf Buttons muss
  hell bleiben). Neue Seiten in der bestehenden Farbwelt halten
  (gray/white/green/amber/red); neue Farbtöne brauchen einen Dark-Override.
- **Mobile (iPhone 13 mini / Galaxy A34):** `viewport-fit=cover` +
  Safe-Area-Paddings im Layout; Eingabefelder unter 768px mindestens **16px**
  Schrift (sonst zoomt iOS-Safari beim Fokussieren). Foto-Uploads brauchen
  `BODY_SIZE_LIMIT` (Default 512K von adapter-node → im Image auf 15M gesetzt).
  Kopfbereiche mit Button-Gruppen: äußeren Container `flex-wrap` lassen und
  **kein `shrink-0`** auf die Gruppe — sonst ragt sie bei 375px über den Rand
  bzw. erzwingt horizontales Scrollen (ist zweimal passiert: Rezept- und
  Artikelliste).
- **Ton (`sound.ts`):** Browser erlauben Audio erst nach einer
  Nutzerinteraktion — der AudioContext wird deshalb beim Öffnen des Scanners
  und beim ersten Tap freigeschaltet. Auf dem iPhone kann der Stummschalter
  den Ton trotzdem unterdrücken; dagegen setzt das Modul
  `navigator.audioSession.type = 'playback'` (nur Safari ≥ 16.4,
  feature-detected). `navigator.vibrate` ignoriert iOS komplett — Ton und
  Vibration ergänzen sich also, ersetzen einander nicht.
- **Android-Installierbarkeit:** `static/service-worker.js` (Passthrough, kein
  Caching) ist **Pflicht**, nicht optional — ohne registrierten Service Worker
  erkennt Chrome die Seite nicht als vollwertige PWA (WebAPK) und installiert
  stattdessen einen alten Fallback-Wrapper. Symptome davon: „für ein älteres
  Android erstellt"-Warnung beim Hinzufügen zum Startbildschirm **und**
  Kamera-Zugriff (Scanner) scheitert ohne Berechtigungsabfrage, auch nicht
  manuell in den Android-Einstellungen nachrüstbar. Icons fürs Manifest als
  PNG (192/512, `purpose: "any maskable"`) bereithalten — SVG-only wird von
  manchen Android-WebAPK-Mintern nicht zuverlässig akzeptiert.
- **Env:** Passwörter mit `#`/`$` in `.env` und `docker-compose*.yml` **quoten**
  (unquotiertes `#` wird als Kommentar abgeschnitten). Die App liest die `.env`
  im Projektstamm. Erster Admin via `ADMIN_USERNAME`/`ADMIN_PASSWORD`.
- **Nicht committen:** `local.db*`, `/data`, `/images`, `picnic-auth-key`, `.env`
  (alle gitignored). Testdaten in der lokalen DB nach Verifikation wieder
  aufräumen.
- **Deployment:** Push auf `main` baut per GitHub Actions das Multi-Arch-Image
  nach GHCR. `docker-compose.prod.yml` (Traefik) fürs Ziehen des Images. Der
  Workflow reicht `GIT_SHA`/`BUILD_TIME` als Build-Args ins Image; die
  Konto-Seite zeigt beides unter **Version** an. Bei „läuft mein Fix schon?"
  **immer zuerst dort nachsehen** — das war schon mehrfach die Ursache
  vermeintlicher Bugs.
- **Formulare:** `use:enhance` macht standardmäßig ein `form.reset()` nach
  erfolgreichem Absenden. Svelte setzt `value`/`checked` nur als DOM-Property
  (ohne HTML-Attribut), Felder fallen dadurch auf **leer** zurück. Überall,
  wo ein Formular Daten trägt, die das Absenden überleben müssen (Mengen,
  versteckte Felder), deshalb `use:enhance={keepValues}` aus `$lib/forms`
  verwenden. Fällt beim Testen leicht durchs Raster: nach direktem
  Seitenaufruf liefert SSR echte `value`-Attribute, der Fehler zeigt sich nur
  nach App-interner Navigation.
- **„Beim testen gefundene Bugs.md":** Kommunikationskanal des Nutzers — dort
  landen beim Testen gefundene Bugs und Feature-Wünsche. Beim Abarbeiten den
  Eintrag durchstreichen und mit **✅ Behoben/Umgesetzt** samt kurzer Erklärung
  versehen, nicht löschen.
