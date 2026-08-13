/**
 * Liest CHANGELOG.md (Format: Keep a Changelog 1.1.0) in eine Struktur ein,
 * die sich in der App darstellen lässt. Bewusst ein eigener Mini-Parser statt
 * einer Markdown-Bibliothek: Das Format ist eng gesteckt, und die Einträge
 * bleiben so reiner Text — es landet kein HTML aus der Datei in der Seite.
 */

export type ChangelogEntry = {
	/** Führende Hervorhebung am Zeilenanfang, z.B. „**Lagerverwaltung** …". */
	label: string | null;
	text: string;
};

export type ChangelogSection = {
	/** Kategorie laut Keep a Changelog, z.B. „Hinzugefügt". */
	title: string;
	entries: ChangelogEntry[];
};

export type ChangelogRelease = {
	/** Versionsnummer bzw. „Unveröffentlicht". */
	version: string;
	/** ISO-Datum aus der Überschrift, falls vorhanden. */
	date: string | null;
	/** Einleitender Satz unter der Überschrift, falls vorhanden. */
	note: string | null;
	sections: ChangelogSection[];
};

/** Hervorhebungen entfernen — angezeigt wird reiner Text. */
function stripEmphasis(text: string): string {
	return text.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

function parseEntry(raw: string): ChangelogEntry {
	const labelled = raw.match(/^\*\*(.+?)\*\*[\s:—-]*(.*)$/s);
	if (labelled) {
		return { label: labelled[1].trim(), text: stripEmphasis(labelled[2]) };
	}
	return { label: null, text: stripEmphasis(raw) };
}

/**
 * Versionen in Dateireihenfolge (neueste zuerst). Versionen ohne Inhalt —
 * typischerweise „Unveröffentlicht" — werden weggelassen.
 */
export function parseChangelog(markdown: string): ChangelogRelease[] {
	const releases: ChangelogRelease[] = [];
	let release: ChangelogRelease | null = null;
	let section: ChangelogSection | null = null;
	let entry: string[] | null = null;

	/** Angefangenen Listenpunkt in den aktuellen Abschnitt übernehmen. */
	const flushEntry = () => {
		if (entry && section) section.entries.push(parseEntry(entry.join(' ')));
		entry = null;
	};

	for (const line of markdown.split(/\r?\n/)) {
		const heading = line.match(/^##\s+\[?([^\]]+?)\]?(?:\s+-\s+(\S+))?\s*$/);
		if (heading && !line.startsWith('###')) {
			flushEntry();
			release = { version: heading[1].trim(), date: heading[2] ?? null, note: null, sections: [] };
			releases.push(release);
			section = null;
			continue;
		}

		const sectionHeading = line.match(/^###\s+(.+?)\s*$/);
		if (sectionHeading && release) {
			flushEntry();
			section = { title: sectionHeading[1].trim(), entries: [] };
			release.sections.push(section);
			continue;
		}

		const bullet = line.match(/^[-*]\s+(.*)$/);
		if (bullet && section) {
			flushEntry();
			entry = [bullet[1]];
			continue;
		}

		// Eingerückte Folgezeile gehört zum laufenden Listenpunkt
		if (entry && /^\s+\S/.test(line)) {
			entry.push(line.trim());
			continue;
		}

		flushEntry();

		// Freitext direkt unter der Versionsüberschrift wird zur Notiz
		const text = line.trim();
		if (release && !section && text && !text.startsWith('[') && !release.note) {
			release.note = stripEmphasis(text);
		}
	}
	flushEntry();

	return releases.filter((r) => r.sections.length > 0 || r.note);
}
