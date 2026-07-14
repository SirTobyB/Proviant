/**
 * Zerlegt Picnic-Gebindeangaben („unit_quantity") in Menge + Einheit
 * für unseren Artikelstamm. Rein und eigenständig testbar.
 *
 * Beispiele: „500g" → 500 g · „1,5l" → 1.5 l · „6 Stück" → 6 Stück ·
 * „6er Pack" → 6 Stück · „2 x 125g" → 250 g · „1 Stück mind. 300g" → 1 Stück
 */

export type ParsedUnitQuantity = { amount: number | null; unit: string | null };

const num = (s: string) => parseFloat(s.replace(',', '.'));

export function parseUnitQuantity(text: string | null | undefined): ParsedUnitQuantity {
	const clean = (text ?? '').trim();
	if (!clean) return { amount: null, unit: null };

	// „2 x 125g" / „3x250ml" → Gesamtmenge
	let match = clean.match(/^([\d.,]+)\s*x\s*([\d.,]+)\s*(g|kg|ml|l)\b/i);
	if (match) {
		return { amount: num(match[1]) * num(match[2]), unit: match[3].toLowerCase() };
	}

	// „1 Stück mind. 300g" / „6 Stück" / „18 Stück"
	match = clean.match(/^([\d.,]+)\s*St(?:ück|k\.?)\b/i);
	if (match) return { amount: num(match[1]), unit: 'Stück' };

	// „6er Pack" / „4er-Pack"
	match = clean.match(/^([\d.,]+)\s*er[\s-]?Pack/i);
	if (match) return { amount: num(match[1]), unit: 'Stück' };

	// „500g" / „1,5 kg" / „750ml" / „0,7l"
	match = clean.match(/^([\d.,]+)\s*(g|kg|ml|l)\b/i);
	if (match) return { amount: num(match[1]), unit: match[2].toLowerCase() };

	return { amount: null, unit: null };
}
