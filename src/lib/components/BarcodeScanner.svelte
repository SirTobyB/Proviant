<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { translator } from '$lib/i18n';
	import { playScanBeep, unlockAudio } from '$lib/sound';
	// Die WASM-Datei wird mitgebaut und aus dem eigenen Build ausgeliefert.
	// Voreingestellt lädt zxing-wasm sie zur Laufzeit von fastly.jsdelivr.net —
	// damit führte die App fremden Code aus einer Quelle aus, die niemand hier
	// kontrolliert, jeder Scan meldete die IP dorthin, und ohne Internet (oder
	// bei DNS-Sperren) blieb der Scanner auf dem iPhone schlicht stehen.
	import zxingWasm from 'zxing-wasm/reader/zxing_reader.wasm?url';

	let { onDetect }: { onDetect: (ean: string) => void } = $props();

	const t = $derived(translator(page.data.locale));

	let video = $state<HTMLVideoElement>();
	let cameraError = $state(false);
	let starting = $state(true);
	let manualEan = $state('');

	let stream: MediaStream | null = null;
	let timer: ReturnType<typeof setInterval> | null = null;
	let detected = false;

	onMount(() => {
		start();
		// Ton möglichst früh freischalten: klappt, wenn im Dokument schon getippt
		// wurde (etwa beim Navigieren hierher). Beim Kaltstart direkt auf dieser
		// Seite holt es der erste Tap nach.
		unlockAudio();
		window.addEventListener('pointerdown', unlockAudio, { once: true });
		return () => {
			window.removeEventListener('pointerdown', unlockAudio);
			stop();
		};
	});

	async function start() {
		try {
			// Ponyfill: nutzt den nativen BarcodeDetector, wo vorhanden (Android Chrome), sonst WASM
			const { BarcodeDetector, setZXingModuleOverrides } = await import('barcode-detector/ponyfill');
			// Muss vor dem ersten detect() stehen — danach ist das Modul geladen.
			setZXingModuleOverrides({
				locateFile: (pfad: string, prefix: string) => (pfad.endsWith('.wasm') ? zxingWasm : prefix + pfad)
			});
			const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8'] });

			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' },
				audio: false
			});
			if (!video) throw new Error(t('scan.cameraMissing'));
			video.srcObject = stream;
			await video.play();
			starting = false;

			timer = setInterval(async () => {
				if (detected || !video || video.readyState < 2) return;
				try {
					const codes = await detector.detect(video);
					if (codes.length > 0 && codes[0].rawValue) {
						detected = true;
						playScanBeep();
						navigator.vibrate?.(100); // iOS ignoriert das, daher zusätzlich der Ton
						stop();
						onDetect(codes[0].rawValue);
					}
				} catch {
					// einzelne Frames dürfen fehlschlagen
				}
			}, 250);
		} catch {
			starting = false;
			cameraError = true;
		}
	}

	function stop() {
		if (timer) clearInterval(timer);
		timer = null;
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
	}

	function submitManual(event: SubmitEvent) {
		event.preventDefault();
		const ean = manualEan.replace(/\D/g, '');
		if (ean.length >= 8) {
			stop();
			onDetect(ean);
		}
	}
</script>

<div class="overflow-hidden rounded-xl border border-gray-200 bg-black">
	{#if cameraError}
		<div class="flex aspect-[4/3] items-center justify-center bg-gray-100 p-6 text-center text-sm text-gray-500">
			Kamera nicht verfügbar — EAN unten von Hand eingeben.
		</div>
	{:else}
		<div class="relative">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={video} playsinline muted class="aspect-[4/3] w-full object-cover"></video>
			{#if starting}
				<div class="absolute inset-0 flex items-center justify-center bg-gray-900/60 text-sm text-white">
					Kamera wird gestartet …
				</div>
			{:else}
				<!-- Ziel-Rahmen als Scanhilfe -->
				<div class="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/70"></div>
			{/if}
		</div>
	{/if}
</div>

<form onsubmit={submitManual} class="mt-3 flex gap-2">
	<input
		type="text"
		inputmode="numeric"
		bind:value={manualEan}
		placeholder={t('scan.manualEan')}
		class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
	/>
	<button
		type="submit"
		disabled={manualEan.replace(/\D/g, '').length < 8}
		class="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
	>
		Suchen
	</button>
</form>
