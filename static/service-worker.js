/**
 * Minimaler Service Worker — bewusst ohne Caching.
 *
 * Zweck ist nicht Offline-Fähigkeit, sondern dass Chrome auf Android die
 * Installierbarkeits-Kriterien für eine echte PWA (WebAPK) als erfüllt
 * ansieht. Ohne registrierten Service Worker mit fetch-Handler fällt Chrome
 * beim „Zum Startbildschirm hinzufügen" auf einen alten, intern gebündelten
 * Fallback-Wrapper zurück — der zeigt die Warnung „für ein älteres Android
 * erstellt" und hat keine funktionierende Berechtigungsbrücke zu Android
 * (Kamera-Zugriff scheitert dann ohne jede Berechtigungsabfrage).
 *
 * Alle Requests gehen unverändert ans Netzwerk — Formulare, Session-Cookies
 * und frische Daten bleiben so garantiert unangetastet.
 */

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
	event.respondWith(fetch(event.request));
});
