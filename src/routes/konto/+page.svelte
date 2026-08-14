<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { BCP47, LOCALES, LOCALE_LABEL, translator } from '$lib/i18n';

	let { data, form } = $props();

	// Übersetzer aus der Sprache dieser Anfrage — nie aus einem globalen
	// Zustand, siehe Kommentar in $lib/i18n/translate.ts
	const t = $derived(translator(data.locale));

	const roleLabel = $derived(t(data.account?.role === 'admin' ? 'users.roleAdmin' : 'users.roleUser'));

	// Zeitzone bewusst fest: sonst formatieren Server (UTC) und Browser
	// unterschiedlich und die Hydration meldet eine Abweichung
	const buildLabel = $derived.by(() => {
		if (!data.version.buildTime) return t('account.localBuild');
		const date = new Date(data.version.buildTime);
		if (Number.isNaN(date.getTime())) return data.version.buildTime;
		return date.toLocaleString(BCP47[data.locale], {
			timeZone: 'Europe/Berlin',
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	});
	const commitLabel = $derived(data.version.commit ? data.version.commit.slice(0, 7) : t('account.unknown'));

	/** Datum aus dem Changelog deutsch, ohne die feste Zeitzone zu brauchen. */
	function releaseDate(iso: string | null): string {
		if (!iso) return '';
		const [year, month, day] = iso.split('-');
		return day && month && year ? `${day}.${month}.${year}` : iso;
	}
</script>

<svelte:head><title>{t('account.title')} – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">{t('account.title')}</h1>

<div class="mt-4 max-w-md space-y-4">
	<!-- Kontodaten -->
	<div class="rounded-xl border border-gray-200 bg-white p-4">
		<dl class="space-y-1 text-sm">
			<div class="flex justify-between"><dt class="text-gray-500">{t('account.username')}</dt><dd class="font-medium">{data.account?.username}</dd></div>
			<div class="flex justify-between"><dt class="text-gray-500">{t('account.email')}</dt><dd>{data.account?.email}</dd></div>
			<div class="flex justify-between"><dt class="text-gray-500">{t('account.role')}</dt><dd>{roleLabel}</dd></div>
		</dl>
		<!-- Auf dem Handy der einzige Weg zur Verwaltung (Sidebar nur ab md) -->
		{#if data.account?.role === 'admin'}
			<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1">
				<a href="/benutzer" class="text-sm font-medium text-green-700 hover:underline">{t('account.userManagement')}</a>
				<a href="/lagerorte" class="text-sm font-medium text-green-700 hover:underline">{t('account.locations')}</a>
			</div>
		{/if}
	</div>

	<!-- Sprache -->
	<div class="rounded-xl border border-gray-200 bg-white p-4">
		<h2 class="text-sm font-semibold text-gray-700">{t('account.language.title')}</h2>
		<p class="mt-1 text-xs text-gray-500">{t('account.language.description')}</p>

		{#if form?.languageMessage}
			<div class="mt-3 rounded-lg px-4 py-3 text-sm {form.languageOk ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}">
				{form.languageMessage}
			</div>
		{/if}

		<form
			method="POST"
			action="?/setLanguage"
			use:enhance={() => async ({ update }) => {
				// reset: false haelt die Auswahl; invalidateAll laedt die Seite in
				// der neuen Sprache neu, sonst bliebe die alte stehen
				await update({ reset: false });
				await invalidateAll();
			}}
			class="mt-3 flex flex-wrap items-end gap-2"
		>
			<div class="min-w-0 flex-1">
				<label for="locale" class="sr-only">{t('account.language.title')}</label>
				<select
					id="locale"
					name="locale"
					class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
				>
					<option value="" selected={!data.account?.locale}>
						{t('account.language.system', { name: LOCALE_LABEL[data.systemLocale] })}
					</option>
					{#each LOCALES as locale (locale)}
						<option value={locale} selected={data.account?.locale === locale}>{LOCALE_LABEL[locale]}</option>
					{/each}
				</select>
			</div>
			<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
				{t('account.language.save')}
			</button>
		</form>
	</div>

	<!-- Passwort ändern -->
	<div class="rounded-xl border border-gray-200 bg-white p-4">
		<h2 class="text-sm font-semibold text-gray-700">{t('account.changePassword')}</h2>

		{#if form?.message}
			<div class="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
		{/if}
		{#if form && 'changed' in form && form.changed}
			<div class="mt-3 rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">{t('account.passwordChanged')}</div>
		{/if}

		<form method="POST" action="?/changePassword" use:enhance class="mt-3 space-y-3">
			<div>
				<label for="current" class="block text-xs font-medium text-gray-500">{t('account.currentPassword')}</label>
				<input id="current" name="current" type="password" autocomplete="current-password" required class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
			</div>
			<div>
				<label for="next" class="block text-xs font-medium text-gray-500">{t('account.newPassword')}</label>
				<input id="next" name="next" type="password" autocomplete="new-password" required class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
			</div>
			<div>
				<label for="confirm" class="block text-xs font-medium text-gray-500">{t('account.confirmPassword')}</label>
				<input id="confirm" name="confirm" type="password" autocomplete="new-password" required class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
			</div>
			<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">{t('account.changePassword')}</button>
		</form>
	</div>

	<!-- Abmelden -->
	<form method="POST" action="/logout" use:enhance>
		<button type="submit" class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
			{t('account.logout')}
		</button>
	</form>

	<!-- Laufende Version: zur Kontrolle, ob der Server den erwarteten Stand fährt -->
	<div class="rounded-xl border border-gray-200 bg-white p-4">
		<h2 class="text-sm font-semibold text-gray-700">{t('account.version')}</h2>
		<dl class="mt-2 space-y-1 text-sm">
			<div class="flex justify-between gap-3">
				<dt class="text-gray-500">App</dt>
				<dd class="font-medium">{data.version.app}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-gray-500">{t('account.build')}</dt>
				<dd>{buildLabel}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-gray-500">{t('account.commit')}</dt>
				<dd class="font-mono text-xs">{commitLabel}</dd>
			</div>
		</dl>
	</div>

	<!-- Changelog: neueste Version offen, ältere zum Aufklappen -->
	{#if data.releases.length > 0}
		<div class="rounded-xl border border-gray-200 bg-white p-4">
			<h2 class="text-sm font-semibold text-gray-700">{t('account.changes')}</h2>
			<!-- Der Changelog wird bewusst nicht uebersetzt (dreifache Pflege) -->
			{#if data.locale !== 'de'}
				<p class="mt-1 text-xs text-gray-500">{t('account.changesGermanOnly')}</p>
			{/if}
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
