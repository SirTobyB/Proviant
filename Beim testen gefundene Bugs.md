# Beim testen gefundene Bugs

- ~~Wenn bei der Artikelanlage mit dem Smartphone ein Foto gemacht wird mit der Kamera, dann führt das Speichern des Artikels zu einem 500er Fehler.~~
  **✅ Behoben:** adapter-node begrenzt Request-Bodies standardmäßig auf 512 KB
  (`Content-length of 2535559 exceeds limit of 524288 bytes`). Das Image setzt
  jetzt `BODY_SIZE_LIMIT=15M` (Dockerfile), zusätzlich wurde das interne
  Bildlimit auf 10 MB erhöht. A/B-verifiziert am Produktions-Build: ohne Limit
  413, mit Limit geht ein 2,5-MB-Upload durch. Fix greift nach dem nächsten
  `docker compose pull && up -d`.

# Optimierungen / Features

- ~~Die Verknüpfung mit Picnic in Artikel verbessern. Am besten den Suchbegriff
  übersteuern können und direkt eine PicnicId angeben können. Kann man in Picnic
  per EAN suchen?~~
  **✅ Umgesetzt / geklärt:**
  - Suchbegriff übersteuern ging schon (das Suchfeld nutzt den Artikelnamen nur
    als Platzhalter — eigener Text im Feld gewinnt).
  - **Neu:** Im Abschnitt „Picnic-Verknüpfung" gibt es jetzt ein Feld „Oder
    Picnic-ID direkt (z.B. s1027848)" mit Übernehmen-Button.
  - EAN-Suche in Picnic: **geht nicht** — live getestet, die Picnic-Suche
    liefert für EANs 0 Treffer (Namenssuche für dasselbe Produkt: 6 Treffer).
    Die API bietet keine EAN-Abfrage an.
