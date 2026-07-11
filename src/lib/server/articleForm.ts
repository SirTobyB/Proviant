/**
 * Gemeinsame Auswertung des Artikelformulars (Neuanlage und Bearbeitung).
 */
import { saveImageFromUpload, saveImageFromUrl, saveImageFromDataUri } from '$lib/server/images';
import { ensureLoggedIn, getProductImage } from '$lib/server/picnic';

export const UNITS = ['g', 'kg', 'ml', 'l', 'Stück'] as const;

export type ArticleFormResult = {
	values: {
		name: string;
		amount: number | null;
		unit: string | null;
		ean: string | null;
		picnicId: string | null;
		minStock: number;
		defaultLocationId: number | null;
	};
	/** Neuer Bild-Dateiname; undefined = Bild unverändert lassen */
	imagePath: string | undefined;
	error: string | null;
};

export async function parseArticleForm(formData: FormData): Promise<ArticleFormResult> {
	const text = (key: string) => {
		const value = formData.get(key);
		return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
	};

	const name = text('name');
	if (!name) return { values: emptyValues(), imagePath: undefined, error: 'Name ist erforderlich' };

	const amountRaw = text('amount');
	const amount = amountRaw ? parseFloat(amountRaw.replace(',', '.')) : null;
	if (amountRaw && Number.isNaN(amount)) {
		return { values: emptyValues(), imagePath: undefined, error: 'Menge ist keine Zahl' };
	}

	const values: ArticleFormResult['values'] = {
		name,
		amount,
		unit: text('unit'),
		ean: text('ean')?.replace(/\D/g, '') || null,
		picnicId: text('picnicId'),
		minStock: parseInt(text('minStock') ?? '0', 10) || 0,
		defaultLocationId: text('defaultLocationId') ? Number(text('defaultLocationId')) : null
	};

	// Bild-Priorität: Upload > Open-Food-Facts-URL > Picnic-Bild
	let imagePath: string | undefined;
	try {
		const upload = formData.get('image');
		const imageUrl = text('imageUrl');
		const picnicImageId = text('picnicImageId');
		if (upload instanceof File && upload.size > 0) {
			imagePath = await saveImageFromUpload(upload);
		} else if (imageUrl) {
			imagePath = await saveImageFromUrl(imageUrl);
		} else if (picnicImageId) {
			await ensureLoggedIn();
			imagePath = saveImageFromDataUri(await getProductImage(picnicImageId));
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Bild konnte nicht gespeichert werden';
		return { values, imagePath: undefined, error: `Bild: ${message}` };
	}

	return { values, imagePath, error: null };
}

function emptyValues(): ArticleFormResult['values'] {
	return {
		name: '',
		amount: null,
		unit: null,
		ean: null,
		picnicId: null,
		minStock: 0,
		defaultLocationId: null
	};
}
