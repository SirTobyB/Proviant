<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const roleLabel = $derived(data.account?.role === 'admin' ? 'Admin' : 'Benutzer');

	// Zeitzone bewusst fest: sonst formatieren Server (UTC) und Browser
	// unterschiedlich und die Hydration meldet eine Abweichung
	const buildLabel = $derived.by(() => {
		if (!data.version.buildTime) return 'lokaler Build';
		const date = new Date(data.version.buildTime);
		if (Number.isNaN(date.getTime())) return data.version.buildTime;
		return date.toLocaleString('de-DE', {
			timeZone: 'Europe/Berlin',
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	});
	const commitLabel = $derived(data.version.commit ? data.version.commit.slice(0, 7) : 'unbekannt');

	/** Datum aus dem Changelog deutsch, ohne die feste Zeitzone zu brauchen. */
	function releaseDate(iso: string | null): string {
		if (!iso) return '';
		const [year, month, day] = iso.split('-');
		return day && month && year ? `${day}.${month}.${year}` : iso;
	}
</script>

<svelte:head><title>Konto – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">Konto</h1>

<div class="mt-4 max-w-md space-y-4">
	<!-- Kontodaten -->
	<div class="rounded-xl border border-gray-200 bg-white p-4">
		<dl class="space-y-1 text-sm">
			<div class="flex justify-between"><dt class="text-gray-500">Benutzername</dt><dd class="font-medium">{data.account?.username}</dd></div>
			<div class="flex justify-between"><dt class="text-gray-500">E-Mail</dt><dd>{data.account?.email}</dd></div>
			<div class="flex justify-between"><dt class="text-gray-500">Rolle</dt><dd>{roleLabel}</dd></div>
		</dl>
		{#if data.account?.role === 'admin'}
			<a href="/benutzer" class="mt-3 inline-block text-sm font-medium text-green-700 hover:underline">→ Benutzerverwaltung</a>
		{/if}
	</div>

	<!-- Passwort ändern -->
	<div class="rounded-xl border border-gray-200 bg-white p-4">
		<h2 class="text-sm font-semibold text-gray-700">Passwort ändern</h2>

		{#if form?.message}
			<div class="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
		{/if}
		{#if form && 'changed' in form && form.changed}
			<div class="mt-3 rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">Passwort geändert.</div>
		{/if}

		<form method="POST" action="?/changePassword" use:enhance class="mt-3 space-y-3">
			<div>
				<label for="current" class="block text-xs font-medium text-gray-500">Aktuelles Passwort</label>
				<input id="current" name="current" type="password" autocomplete="current-password" required class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
			</div>
			<div>
				<label for="next" class="block text-xs font-medium text-gray-500">Neues Passwort</label>
				<input id="next" name="next" type="password" autocomplete="new-password" required class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
			</div>
			<div>
				<label for="confirm" class="block text-xs font-medium text-gray-500">Neues Passwort bestätigen</label>
				<input id="confirm" name="confirm" type="password" autocomplete="new-password" required class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
			</div>
			<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Passwort ändern</button>
		</form>
	</div>

	<!-- Abmelden -->
	<form method="POST" action="/logout" use:enhance>
		<button type="submit" class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
			Abmelden
		</button>
	</form>

	<!-- Laufende Version: zur Kontrolle, ob der Server den erwarteten Stand fährt -->
	<div class="rounded-xl border border-gray-200 bg-white p-4">
		<h2 class="text-sm font-semibold text-gray-700">Version</h2>
		<dl class="mt-2 space-y-1 text-sm">
			<div class="flex justify-between gap-3">
				<dt class="text-gray-500">App</dt>
				<dd class="font-medium">{data.version.app}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-gray-500">Build</dt>
				<dd>{buildLabel}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-gray-500">Commit</dt>
				<dd class="font-mono text-xs">{commitLabel}</dd>
			</div>
		</dl>
	</div>

	<!-- Changelog: neueste Version offen, ältere zum Aufklappen -->
	{#if data.releases.length > 0}
		<div class="rounded-xl border border-gray-200 bg-white p-4">
			<h2 class="text-sm font-semibold text-gray-700">Änderungen</h2>
			<div class="mt-2 space-y-2">
				{#each data.releases as release, index (release.version)}
					<details open={index === 0} class="group">
						<summary class="flex cursor-pointer items-center gap-2 text-sm font-medium marker:content-['']">
							<span class="text-gray-400 transition group-open:rotate-90">▸</span>
							<span>{release.version}</span>
							{#if release.date}
								<span class="text-xs font-normal text-gray-500">{releaseDate(release.date)}</span>
							{/if}
						</summary>
						<div class="mt-1 pl-5">
							{#if release.note}
								<p class="text-xs text-gray-500">{release.note}</p>
							{/if}
							{#each release.sections as section (section.title)}
								<h3 class="mt-2 text-xs font-semibold text-gray-600">{section.title}</h3>
								<ul class="mt-1 space-y-1">
									{#each section.entries as entry, i (i)}
										<li class="flex gap-1.5 text-sm text-gray-700">
											<span class="text-gray-300">•</span>
											<span>
												{#if entry.label}<span class="font-medium">{entry.label}</span>{' '}{/if}{entry.text}
											</span>
										</li>
									{/each}
								</ul>
							{/each}
						</div>
					</details>
				{/each}
			</div>
		</div>
	{/if}
</div>
