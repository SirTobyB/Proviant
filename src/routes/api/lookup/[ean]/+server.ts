import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * EAN-Lookup über Open Food Facts zur Vorbefüllung des Artikelformulars.
 * Liefert { found, name, amount, unit, imageUrl }.
 */
export const GET: RequestHandler = async ({ params, fetch }) => {
	const ean = params.ean.replace(/\D/g, '');
	if (ean.length < 8) return json({ found: false });

	const response = await fetch(
		`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,product_name_de,brands,quantity,image_front_url`,
		{ headers: { 'User-Agent': 'Proviant/1.0 (selfhosted family app)' } }
	);
	if (!response.ok) return json({ found: false });

	const body = (await response.json()) as {
		status: number;
		product?: {
			product_name?: string;
			product_name_de?: string;
			brands?: string;
			quantity?: string;
			image_front_url?: string;
		};
	};
	if (body.status !== 1 || !body.product) return json({ found: false });

	const product = body.product;
	const baseName = product.product_name_de || product.product_name || '';
	const brand = product.brands?.split(',')[0]?.trim();
	const name = brand && !baseName.toLowerCase().includes(brand.toLowerCase())
		? `${brand} ${baseName}`.trim()
		: baseName;

	// Mengenangabe wie "500 g", "1,5 l" oder "6 x 1.5 L" grob zerlegen
	let amount: number | null = null;
	let unit: string | null = null;
	const quantityMatch = product.quantity?.match(/([\d.,]+)\s*(kg|g|ml|l)\b/i);
	if (quantityMatch) {
		amount = parseFloat(quantityMatch[1].replace(',', '.'));
		unit = quantityMatch[2].toLowerCase();
	}

	return json({
		found: Boolean(name),
		name,
		amount,
		unit,
		imageUrl: product.image_front_url ?? null
	});
};
