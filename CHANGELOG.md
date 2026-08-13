# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei
dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
und dieses Projekt hält sich an [Semantic Versioning](https://semver.org/lang/de/).

## [Unveröffentlicht]

## [1.0.0] - 2026-08-13

Erste versionierte Fassung — der bisherige Funktionsumfang als Ausgangspunkt.

### Hinzugefügt

- **Lagerverwaltung** mit fünf Lagerorten, geführt als Chargen mit eigenem MHD,
  MHD-Ampel und „Läuft bald ab"-Ansicht. Schnellkorrektur mit +/− in der
  Artikelliste und je Charge in der Lagerort-Ansicht, Umlagern zwischen
  Lagerorten.
- **Inventur** mit Lagerort-Aufschlüsselung: gezählten Bestand eintragen, die
  Differenz wird automatisch gebucht (Zugang in den Standard-Lagerort, Abgang
  nach nächstem MHD zuerst).
- **Artikelstamm** mit Bild, Gebindegröße, EAN, Mindestbestand,
  Standard-Lagerort und frei vergebbaren Tags. Neuanlage per Barcode-Scan,
  Vorbefüllung über Open Food Facts und Picnic.
- **Barcode-Scanner** zum Ein- und Ausbuchen, mit Signalton und Vibration bei
  erkanntem Code.
- **Bestellvorschläge** für Artikel unter Mindestbestand, abgeglichen mit dem
  Picnic-Warenkorb und noch nicht gelieferten Bestellungen. Bestellt wird nie
  automatisch — der Checkout bleibt in der Picnic-App.
- **Lieferungs-Check** zum Auspacken: Positionen scannen oder per Sichtprüfung
  bestätigen, noch unbekannte Produkte werden dabei automatisch als Artikel
  angelegt.
- **Rezepte** mit Zutaten aus dem Artikelstamm (mehrere Alternativartikel je
  Zutat möglich), Kochbarkeits-Prüfung gegen den Vorrat, Portionsskalierung,
  Tags, Zufallsvorschlag und Import aus Picnic.
- **Wochenplan** für sieben Tage mit gebündelter Einkaufsliste, die den Vorrat
  über die ganze Woche verrechnet.
- **Benutzerverwaltung** mit Rollen und Audit-Feldern auf allen Datensätzen.
- **Versionsanzeige** auf der Konto-Seite mit Build-Zeitpunkt und Commit.
- **Fehlerprotokollierung** mit Zeitstempel, Pfad und Fehler-ID im
  Container-Log.

[Unveröffentlicht]: https://github.com/SirTobyB/LebensmittelKumpel/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/SirTobyB/LebensmittelKumpel/releases/tag/v1.0.0
