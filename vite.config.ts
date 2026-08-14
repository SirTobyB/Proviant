import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter(),

			// Content-Security-Policy. Gehört hierher und nicht in den Hook: nur so
			// versieht SvelteKit seine eigenen Inline-Scripte (Hydration) mit einem
			// Nonce — ein von Hand gesetzter Header müsste stattdessen
			// 'unsafe-inline' erlauben und wäre damit weitgehend wirkungslos.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					// wasm-unsafe-eval: der Barcode-Scanner fällt ohne nativen
					// BarcodeDetector (iOS Safari) auf ZXing als WebAssembly zurück.
					'script-src': ['self', 'wasm-unsafe-eval'],
					'style-src': ['self'],
					// Für das einzige style-Attribut der App (app.html, display:contents).
					// Attribute lassen sich nicht mit einem Nonce versehen.
					'style-src-attr': ['unsafe-inline'],
					// blob: für die Bildvorschau vor dem Absenden (createObjectURL),
					// data: für die in Tailwinds Formular-Styles eingebetteten Icons.
					'img-src': ['self', 'blob:', 'data:'],
					'connect-src': ['self'],
					'font-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'frame-ancestors': ['none'],
					'form-action': ['self']
				}
			},

			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	]
});
