import type { SubmitFunction } from '@sveltejs/kit';

/**
 * Enhance-Callback für Formulare, deren Eingaben das Absenden überleben müssen.
 *
 * SvelteKit ruft nach erfolgreichem Absenden standardmäßig `form.reset()` auf.
 * Svelte setzt `value`/`checked` aber nur als DOM-Property und nicht als
 * HTML-Attribut — die Felder fallen dadurch auf leere Attribut-Defaults zurück
 * (Mengen weg, Haken weg). Fällt beim Testen leicht durchs Raster, weil ein
 * direkter Seitenaufruf serverseitig echte `value`-Attribute liefert und der
 * Fehler nur nach App-interner Navigation auftritt.
 *
 * Verwendung: `use:enhance={keepValues}`
 */
export const keepValues: SubmitFunction = () => async ({ update }) => update({ reset: false });
