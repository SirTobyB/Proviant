<script lang="ts">
	import { enhance } from '$app/forms';
	import { translator } from '$lib/i18n';

	let { data, form } = $props();

	const t = $derived(translator(data.locale));

	// Welcher User wird gerade bearbeitet?
	let editing = $state<string | null>(null);
	let showCreate = $state(false);

	function formatDate(d: Date | string | null): string {
		if (!d) return '';
		return new Date(d).toLocaleDateString('de-DE');
	}
</script>

<svelte:head><title>{t('users.title')} – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold">{t('users.title')}</h1>
		<p class="mt-1 text-sm text-gray-500">{t('users.count', { n: data.users.length })}</p>
	</div>
	<button
		type="button"
		onclick={() => { showCreate = !showCreate; editing = null; }}
		class="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
	>
		{showCreate ? t('form.cancel') : t('users.new')}
	</button>
</div>

{#if form?.message}
	<div class="mt-4 max-w-xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
{/if}
{#if form && 'created' in form && form.created}
	<div class="mt-4 max-w-xl rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">{t('users.created', { name: form.created })}</div>
{/if}

<!-- Neuanlage -->
{#if showCreate}
	<form
		method="POST"
		action="?/create"
		use:enhance={() => async ({ update, result }) => {
			await update();
			if (result.type === 'success') showCreate = false;
		}}
		class="mt-4 max-w-xl rounded-xl border border-gray-200 bg-white p-4"
	>
		<h2 class="text-sm font-semibold text-gray-700">{t('users.newHeading')}</h2>
		<div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
			<div>
				<label for="c-username" class="block text-xs font-medium text-gray-500">{t('users.username')}</label>
				<input id="c-username" name="username" type="text" required class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
			</div>
			<div>
				<label for="c-email" class="block text-xs font-medium text-gray-500">{t('users.email')}</label>
				<input id="c-email" name="email" type="email" required class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
			</div>
			<div>
				<label for="c-password" class="block text-xs font-medium text-gray-500">{t('users.password')}</label>
				<input id="c-password" name="password" type="password" required class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
			</div>
			<div>
				<label for="c-role" class="block text-xs font-medium text-gray-500">{t('users.role')}</label>
				<select id="c-role" name="role" class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
					<option value="user">{t('users.roleUser')}</option>
					<option value="admin">{t('users.roleAdmin')}</option>
				</select>
			</div>
		</div>
		<button type="submit" class="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">{t('users.create')}</button>
	</form>
{/if}

<!-- Liste -->
<ul class="mt-4 max-w-xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
	{#each data.users as user (user.username)}
		<li class="px-4 py-3">
			{#if editing === user.username}
				<form
					method="POST"
					action="?/update"
					use:enhance={() => async ({ update, result }) => {
						await update();
						if (result.type === 'success') editing = null;
					}}
				>
					<input type="hidden" name="username" value={user.username} />
					<div class="flex items-center justify-between">
						<span class="font-medium">{user.username}</span>
						<span class="text-xs text-gray-400">{t('users.editing')}</span>
					</div>
					<div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
						<div>
							<label for={`e-email-${user.username}`} class="block text-xs text-gray-500">{t('users.email')}</label>
							<input id={`e-email-${user.username}`} name="email" type="email" value={user.email} required class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
						</div>
						<div>
							<label for={`e-role-${user.username}`} class="block text-xs text-gray-500">{t('users.role')}</label>
							<select id={`e-role-${user.username}`} name="role" value={user.role} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
								<option value="user">{t('users.roleUser')}</option>
								<option value="admin">{t('users.roleAdmin')}</option>
							</select>
						</div>
						<div class="sm:col-span-2">
							<label for={`e-pw-${user.username}`} class="block text-xs text-gray-500">{t('users.newPassword')}</label>
							<input id={`e-pw-${user.username}`} name="password" type="password" autocomplete="new-password" class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
						</div>
					</div>
					<div class="mt-3 flex gap-2">
						<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">{t('users.save')}</button>
						<button type="button" onclick={() => (editing = null)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{t('form.cancel')}</button>
					</div>
				</form>
			{:else}
				<div class="flex items-center gap-3">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="font-medium">{user.username}</span>
							{#if user.role === 'admin'}
								<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{t('users.roleAdmin')}</span>
							{/if}
							{#if user.username === data.user?.username}
								<span class="text-xs text-gray-400">{t('users.you')}</span>
							{/if}
						</div>
						<div class="text-xs text-gray-500">{user.email}</div>
					</div>
					<button type="button" onclick={() => { editing = user.username; showCreate = false; }} class="shrink-0 text-sm text-gray-500 underline hover:text-gray-700">{t('users.edit')}</button>
					{#if user.username !== data.user?.username}
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="username" value={user.username} />
							<button type="submit" class="shrink-0 text-sm text-red-600 underline hover:text-red-700">{t('users.delete')}</button>
						</form>
					{/if}
				</div>
			{/if}
		</li>
	{/each}
</ul>
