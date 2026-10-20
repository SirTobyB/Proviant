/**
 * Startpunkt des Containers (`node server.js`) — reicht an `build/index.js`
 * von adapter-node durch und hält nur eines am Leben: die Umgebungsvariable
 * `ORIGIN`.
 *
 * adapter-node 6 kennt `ORIGIN` nicht mehr; die öffentliche Adresse soll
 * stattdessen beim Build als `paths.origin` feststehen. Das Image wird aber
 * einmal gebaut und von jedem unter seiner eigenen Adresse betrieben — dort
 * steht sie erst zur Laufzeit fest. Ohne Ersatz leitete adapter-node die
 * Adresse aus dem `Host`-Header ab und nähme als Protokoll stets `https` an;
 * beim Aufruf über http://localhost:3000 (docker-compose.yml) schlüge damit
 * der CSRF-Abgleich fehl und **jedes** Formular endete mit 403, auch die
 * Anmeldung.
 *
 * Ist `ORIGIN` gesetzt, bekommt deshalb jede Anfrage Protokoll und Host
 * daraus als eigene Header, und adapter-node liest genau diese
 * (`PROTOCOL_HEADER`/`HOST_HEADER`). Die Header werden immer überschrieben —
 * ein Client kann sie also nicht vorgeben. Ohne `ORIGIN` bleibt alles beim
 * Verhalten von adapter-node (hinter einem TLS-Proxy wie Traefik genügt das).
 */
import http from 'node:http';
import process from 'node:process';

const origin = process.env.ORIGIN;

if (origin) {
	const url = new URL(origin);
	const PROTOCOL_HEADER = 'x-proviant-origin-proto';
	const HOST_HEADER = 'x-proviant-origin-host';
	process.env.PROTOCOL_HEADER = PROTOCOL_HEADER;
	process.env.HOST_HEADER = HOST_HEADER;

	// adapter-node legt seinen Server per http.createServer() an; der eigene
	// Listener läuft per prependListener vor dessen Request-Handler.
	const createServer = http.createServer;
	http.createServer = function (...args) {
		const server = createServer.apply(this, args);
		server.prependListener('request', (req) => {
			req.headers[PROTOCOL_HEADER] = url.protocol.slice(0, -1);
			req.headers[HOST_HEADER] = url.host;
		});
		return server;
	};
}

await import('./build/index.js');
