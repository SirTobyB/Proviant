import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Bewusst ohne das SvelteKit-Plugin: getestet werden nur die reinen
 * Logik-Module (keine Komponenten, kein $app/$env), das hält den Lauf schnell
 * und unabhängig vom Framework.
 */
export default defineConfig({
	resolve: {
		alias: { $lib: path.resolve('./src/lib') }
	},
	test: {
		include: ['src/**/*.test.ts']
	}
});
