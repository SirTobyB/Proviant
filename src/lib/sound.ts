/**
 * Kurzer Signalton für erfolgreiche Scans — per Web Audio erzeugt, damit keine
 * Audiodatei ausgeliefert werden muss.
 *
 * Browser erlauben Ton erst, wenn im Dokument einmal getippt wurde. Der
 * AudioContext wird deshalb beim ersten Tap freigeschaltet (`unlockAudio`) und
 * danach wiederverwendet. Klappt es trotzdem nicht (z.B. Stummschalter am
 * iPhone), bleibt es still — der Ton ist Beiwerk und darf den Scan nie stören.
 */

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (context) return context;

	const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
	if (!Ctor) return null;
	try {
		context = new Ctor();
	} catch {
		return null;
	}

	// Safari ab 16.4: lässt den Ton auch bei eingeschaltetem Stummschalter durch.
	// Nur hier relevant — Android ignoriert die Eigenschaft.
	try {
		const session = (navigator as AudioSessionNavigator).audioSession;
		if (session) session.type = 'playback';
	} catch {
		// nicht unterstützt — dann gilt weiterhin der Stummschalter
	}
	return context;
}

/**
 * Schaltet die Tonausgabe frei. Beim Öffnen des Scanners und beim ersten Tap
 * aufrufen: ohne vorherige Nutzerinteraktion lehnt der Browser das Abspielen ab.
 */
export function unlockAudio(): void {
	void getContext()?.resume().catch(() => {});
}

/** Kurzer Piep (~100 ms) als Rückmeldung für einen erkannten Barcode. */
export function playScanBeep(): void {
	const ctx = getContext();
	if (!ctx) return;
	void ctx.resume().catch(() => {});

	try {
		const start = ctx.currentTime;
		const oscillator = ctx.createOscillator();
		const gain = ctx.createGain();
		oscillator.type = 'sine';
		oscillator.frequency.value = 1000; // gut hörbar, ohne schrill zu wirken

		// Kurz ein- und ausblenden, sonst knackt der Ton an den Kanten
		gain.gain.setValueAtTime(0, start);
		gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
		gain.gain.linearRampToValueAtTime(0, start + 0.1);

		oscillator.connect(gain).connect(ctx.destination);
		oscillator.start(start);
		oscillator.stop(start + 0.12);
	} catch {
		// Ton fehlgeschlagen — der Scan läuft trotzdem weiter
	}
}
