/**
 * Drosselt Aufrufe an Picnic: einer nach dem anderen, mit Mindestabstand.
 * Rein und ohne SvelteKit-Import, damit eigenständig testbar.
 *
 * Gedacht für Massenabrufe wie „Alle importieren": Jeder Rezeptabruf ist eine
 * große Fusion-Seite (live gut 1 MB), und Picnic quittiert zu dichte Anfragen
 * mit 429 bzw. 403 ohne Code. Die Drossel gilt prozessweit — auch zwei
 * Familienmitglieder, die gleichzeitig importieren, landen in derselben
 * Schlange, statt sich gegenseitig ins Ratelimit zu schieben.
 *
 * Der Abstand zählt ab dem **Ende** des vorigen Aufrufs: ein langsamer Abruf
 * verkürzt die Pause also nicht.
 */
export type ThrottleDeps = {
	now: () => number;
	sleep: (ms: number) => Promise<void>;
};

const realDeps: ThrottleDeps = {
	now: () => Date.now(),
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
};

export function createThrottle(minIntervalMs: number, deps: ThrottleDeps = realDeps) {
	let chain: Promise<void> = Promise.resolve();
	let lastEnd = -Infinity;

	return function run<T>(task: () => Promise<T>): Promise<T> {
		const result = chain.then(async () => {
			const wait = lastEnd + minIntervalMs - deps.now();
			if (wait > 0) await deps.sleep(wait);
			try {
				return await task();
			} finally {
				lastEnd = deps.now();
			}
		});
		// Ein Fehler darf die Schlange nicht anhalten
		chain = result.then(
			() => undefined,
			() => undefined
		);
		return result;
	};
}
