import { defineConfig } from 'vitest/config';

/**
 * Bewusst ohne das SvelteKit-Plugin: getestet werden nur die reinen
 * Logik-Module (keine Komponenten, kein $app), das hält den Lauf schnell
 * und unabhängig vom Framework. `#lib` braucht keinen Alias: Node löst die
 * Subpath-Imports aus package.json selbst auf.
 */
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts']
	}
});
