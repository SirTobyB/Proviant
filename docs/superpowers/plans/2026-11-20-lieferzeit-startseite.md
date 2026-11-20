# Lieferzeit auf der Startseite – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Startseite (und Bestellseite) zeigen die nächste offene Picnic-Lieferung: vorher Tag + Fenster, am Liefertag die Live-ETA.

**Architecture:** Reines Modul `lib/deliveryEta.ts` (Auswahl, Live-Schwelle, Anzeigetext) mit Test; Adapter-Funktion `getNextDelivery()` im Picnic-Modul; Routen geben die Info als nicht abgewartetes Promise zurück (Streaming), eine Komponente `DeliveryEtaCard` rendert sie clientseitig und lädt auf Wunsch per `invalidate('app:delivery')` nach.

**Tech Stack:** SvelteKit 3, Svelte 5, Vitest, picnic-api 5.

**Spec:** `docs/superpowers/specs/2026-11-20-lieferzeit-startseite-design.md`

## Global Constraints

- Texte nur über `i18n/messages` (en Quelle, de/nl typisiert).
- Picnic nur aus `server/picnic/` importieren; Fehler beim Startseiten-Load dürfen die Seite nie brechen (→ `null`).
- Live-Abfrage ab 12 h vor Fensterbeginn; Auto-Aktualisierung alle 2 min, nur bei sichtbarem Tab, nur Startseite.
- Formatierung im Browser (gestreamt), nicht im SSR — Server-Zeitzone ist im Container UTC.

## Review Focus

- Lieferung ohne `windowStart` (Daten fehlen) → wird übersprungen, keine Karte mit „Invalid Date“.
- Fenster schon vorbei, Lieferung aber noch offen (Verspätung) → Live-Abfrage läuft weiter, Text „heute“ bleibt korrekt.
- `getDeliveryPosition` wirft (Tour noch nicht gestartet) → Fenster wird trotzdem angezeigt.
- Mehrere offene Lieferungen → die mit dem frühesten Fenster.
- Lieferung über Mitternacht/morgen → „Morgen“ statt „Heute“.

---

### Task 1: `lib/deliveryEta.ts` mit Test

**Files:** Create `src/lib/deliveryEta.ts`, `src/lib/deliveryEta.test.ts`; Modify `src/lib/i18n/messages/{en,de,nl}.ts`

**Produces:**
- `type DeliveryEta = { windowStart: string; windowEnd: string | null; eta: string | null }`
- `LIVE_LOOKAHEAD_MS = 12 * 3_600_000`, `DELIVERY_REFRESH_MS = 120_000`
- `nextOpenDelivery<T extends { status: string; windowStart: string | null }>(list: T[]): T | null`
- `wantsLivePosition(windowStart: string, now?: Date): boolean` — Beginn − jetzt < 12 h
- `deliveryEtaText(eta: DeliveryEta, t: Translate, locale: Locale, now?: Date): { main: string; window: string | null }`
- Schlüssel `delivery.today`, `delivery.tomorrow`, `delivery.window` (`{day}, {from}–{to}`), `delivery.live` (`{day} at about {time}`), `delivery.bookedWindow` (`window {from}–{to}`)

- [ ] Tests: Auswahl (COMPLETED/CANCELLED/ohne Fenster raus, frühestes zuerst), Schwelle (11 h → true, 13 h → false, vorbei → true), Text (heute/morgen/Wochentag, mit und ohne ETA, ohne `windowEnd`) — laufen rot
- [ ] Implementieren, `npm test` grün

### Task 2: Adapter + Routen + Komponente

**Files:** Modify `src/lib/server/picnic/index.ts` (`getDeliveryEta` → `getNextDelivery(): Promise<DeliveryEta | null>`), `src/routes/+page.server.ts`, `src/routes/+page.svelte`, `src/routes/bestellen/+page.server.ts`, `src/routes/bestellen/+page.svelte`; Create `src/lib/components/DeliveryEtaCard.svelte` (Props `delivery: Promise<DeliveryEta | null> | null`, `locale`, `autoRefresh?: boolean`)

- [ ] Beide Loads: `depends('app:delivery')`, `delivery: connected ? getNextDelivery().catch(log → null) : null` (nicht abgewartet)
- [ ] Karte hält letzten Wert in `$state` (kein Flackern beim Nachladen), Startseite mit `autoRefresh`
- [ ] Alten `order.eta`-Text und `etaText` entfernen
- [ ] `npm run check` grün

### Task 3: Doku + Verifikation

- [ ] CHANGELOG (Unveröffentlicht/Hinzugefügt), drei READMEs, Wiki (Stock, Ordering)
- [ ] `npm run check`, `npm test`, `npm run build`; Startseite im Browser
- [ ] Commit
