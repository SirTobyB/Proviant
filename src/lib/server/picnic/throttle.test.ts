import { describe, expect, it } from 'vitest';
import { createThrottle, type ThrottleDeps } from './throttle';

/** Künstliche Uhr: `sleep` springt sofort vor und merkt sich die Pausen. */
function fakeClock() {
	let time = 1000;
	const sleeps: number[] = [];
	const deps: ThrottleDeps = {
		now: () => time,
		sleep: async (ms) => {
			sleeps.push(ms);
			time += ms;
		}
	};
	return { deps, sleeps, advance: (ms: number) => (time += ms) };
}

describe('createThrottle', () => {
	it('lässt den ersten Aufruf ohne Pause durch', async () => {
		const clock = fakeClock();
		const run = createThrottle(1500, clock.deps);
		expect(await run(async () => 'a')).toBe('a');
		expect(clock.sleeps).toEqual([]);
	});

	it('hält den Mindestabstand ab dem Ende des vorigen Aufrufs ein', async () => {
		const clock = fakeClock();
		const run = createThrottle(1500, clock.deps);
		await run(async () => clock.advance(400)); // Abruf dauert 400 ms
		await run(async () => 'b');
		expect(clock.sleeps).toEqual([1500]);
	});

	it('wartet nur den Rest, wenn schon Zeit vergangen ist', async () => {
		const clock = fakeClock();
		const run = createThrottle(1500, clock.deps);
		await run(async () => 'a');
		clock.advance(1000);
		await run(async () => 'b');
		expect(clock.sleeps).toEqual([500]);
	});

	it('reiht gleichzeitige Aufrufe nacheinander ein', async () => {
		const clock = fakeClock();
		const run = createThrottle(1000, clock.deps);
		const order: string[] = [];
		let running = 0;
		let maxRunning = 0;
		const task = (name: string) => async () => {
			running++;
			maxRunning = Math.max(maxRunning, running);
			order.push(name);
			await Promise.resolve();
			running--;
			return name;
		};
		const results = await Promise.all([run(task('a')), run(task('b')), run(task('c'))]);
		expect(results).toEqual(['a', 'b', 'c']);
		expect(order).toEqual(['a', 'b', 'c']);
		expect(maxRunning).toBe(1);
		expect(clock.sleeps).toEqual([1000, 1000]);
	});

	it('läuft nach einem Fehler weiter und gibt ihn an den Aufrufer', async () => {
		const clock = fakeClock();
		const run = createThrottle(1000, clock.deps);
		const failing = run(async () => {
			throw new Error('kaputt');
		});
		const next = run(async () => 'weiter');
		await expect(failing).rejects.toThrow('kaputt');
		expect(await next).toBe('weiter');
		expect(clock.sleeps).toEqual([1000]);
	});
});
