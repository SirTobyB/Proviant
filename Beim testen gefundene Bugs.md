# Beim testen gefundene Bugs

- Wenn bei der Artikelanlage mit dem Smartphone ein Foto gemacht wird mit der Kamera, dann führt das Speichern des Artikels zu einem 500er Fehler. Warum? Das Log liefert dazu:
```
[413] POST /artikel/neu
Error: Content-length of 2535559 exceeds limit of 524288 bytes.
    at Object.start (file:///app/build/server/chunks/handler-B4bY7pCi.js:963:19)
    at setupReadableStreamDefaultController (node:internal/webstreams/readablestream:2464:23)
    at setupReadableStreamDefaultControllerFromSource (node:internal/webstreams/readablestream:2496:3)
    at new ReadableStream (node:internal/webstreams/readablestream:279:7)
    at get_raw_body (file:///app/build/server/chunks/handler-B4bY7pCi.js:952:9)
    at getRequest (file:///app/build/server/chunks/handler-B4bY7pCi.js:1072:7)
    at Array.ssr (file:///app/build/server/chunks/handler-B4bY7pCi.js:1329:19)
    at handle (file:///app/build/server/chunks/handler-B4bY7pCi.js:1406:23)
    at file:///app/build/server/chunks/handler-B4bY7pCi.js:1406:40
    at Array.<anonymous> (file:///app/build/server/chunks/handler-B4bY7pCi.js:1318:9)
```

# Optimierungen / Features

- Die Verknüpfung mit Picnic in Artikel verbessern. Am besten den Suchbegriff übersteuern können und direkt eine PicnicId angeben können. Kann man in Picnic per EAN suchen? Dann wäre auch das eine gute Möglichkeit