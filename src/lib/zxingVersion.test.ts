import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Der Barcode-Scanner lädt die ZXing-WASM-Datei aus dem eigenen Build statt von
 * fastly.jsdelivr.net (siehe BarcodeScanner.svelte). Dafür importiert er sie
 * direkt aus `zxing-wasm` — die JS-Anbindung dagegen kommt weiterhin über
 * `barcode-detector`.
 *
 * Beide müssen dieselbe Version sein. Driften sie auseinander (etwa weil ein
 * Update `barcode-detector` anhebt, `zxing-wasm` aber nicht), installiert npm
 * zwei Fassungen nebeneinander: der Scanner lädt dann eine WASM-Datei, die
 * nicht zu seiner Anbindung passt. Auffallen würde das erst am Gerät, und auch
 * dort nur ohne nativen BarcodeDetector — also praktisch nur auf dem iPhone.
 *
 * Gelesen wird direkt aus dem Dateisystem: `barcode-detector` gibt seine
 * package.json nicht über `exports` frei, ein Import scheitert deshalb.
 */
function paket(...teile: string[]): Record<string, Record<string, string>> {
	return JSON.parse(fs.readFileSync(path.resolve(...teile), 'utf8'));
}

describe('ZXing-WASM', () => {
	it('ist in derselben Version eingebunden, die barcode-detector erwartet', () => {
		const direkt = paket('package.json').dependencies['zxing-wasm'];
		const erwartet = paket('node_modules', 'barcode-detector', 'package.json').dependencies['zxing-wasm'];
		expect(direkt).toBe(erwartet);
	});
});
