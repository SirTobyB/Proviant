<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	// Nötig, damit Android die Seite als installierbare PWA (WebAPK) erkennt —
	// siehe Kommentar in static/service-worker.js für den Hintergrund.
	onMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => {});
		}
	});

	const navItems = [
		{
			href: '/',
			label: 'Lager',
			// Heroicons: archive-box
			icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z'
		},
		{
			href: '/inventur',
			label: 'Inventur',
			// Heroicons: clipboard-document-list
			icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z'
		},
		{
			href: '/artikel',
			label: 'Artikel',
			// Heroicons: cube
			icon: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9'
		},
		{
			href: '/rezepte',
			label: 'Rezepte',
			// Heroicons: book-open
			icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25'
		},
		{
			href: '/bestellen',
			label: 'Bestellen',
			// Heroicons: shopping-cart
			icon: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z'
		}
	];

	function isActive(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	// Heroicons: qr-code (als Scan-Symbol)
	const scanIcon =
		'M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z';

	// Konto-Icon (Heroicons: user-circle)
	const userIcon =
		'M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z';
</script>

<svelte:head><link rel="icon" href="/icon.svg" type="image/svg+xml" /></svelte:head>

{#if !data.user}
	<!-- Ohne angemeldeten User (z.B. Login-Seite): keine App-Navigation -->
	{@render children()}
{:else}
	<div class="min-h-dvh bg-gray-50 text-gray-900 md:flex">
		<!-- Sidebar (Desktop) -->
		<aside class="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
			<div class="flex items-center gap-2 px-4 py-5">
				<img src="/icon.svg" alt="" class="h-8 w-8" />
				<span class="text-lg font-bold">LebensmittelKumpel</span>
			</div>
			<nav class="flex flex-1 flex-col gap-1 px-2">
				{#each navItems as item (item.href)}
					<a
						href={item.href}
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
							{isActive(item.href) ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
							<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
						</svg>
						{item.label}
					</a>
				{/each}
				<a
					href="/scan"
					class="mt-2 flex items-center gap-3 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
						<path stroke-linecap="round" stroke-linejoin="round" d={scanIcon} />
					</svg>
					Scannen
				</a>
				<a
					href="/lieferung"
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
						{isActive('/lieferung') ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-6m2.25-13.5h5.379c.621 0 1.129.504 1.09 1.124M14.25 5.25v13.5m0-13.5H5.625c-.621 0-1.125.504-1.125 1.125v10.5" />
					</svg>
					Lieferung prüfen
				</a>
				<a
					href="/journal"
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
						{isActive('/journal') ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
						<!-- Heroicons: queue-list -->
						<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
					</svg>
					Journal
				</a>
			</nav>

			<!-- Konto-Bereich -->
			<div class="border-t border-gray-100 p-2">
				{#if data.user.role === 'admin'}
					<a
						href="/benutzer"
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
							{isActive('/benutzer') ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
						</svg>
						Benutzer
					</a>
					<a
						href="/lagerorte"
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
							{isActive('/lagerorte') ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
							<!-- Heroicons: building-storefront -->
							<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
						</svg>
						Lagerorte
					</a>
				{/if}
				<a
					href="/konto"
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
						{isActive('/konto') ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
						<path stroke-linecap="round" stroke-linejoin="round" d={userIcon} />
					</svg>
					<span class="min-w-0 flex-1 truncate">{data.user.username}</span>
				</a>
			</div>
		</aside>

		<div class="flex min-h-dvh flex-1 flex-col">
			<!-- Header (Mobile); pt berücksichtigt die iPhone-Notch im Standalone-Modus -->
			<header class="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:hidden">
				<div class="flex items-center gap-2">
					<img src="/icon.svg" alt="" class="h-7 w-7" />
					<span class="text-base font-bold">LebensmittelKumpel</span>
				</div>
				<a href="/konto" class="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-gray-600 hover:bg-gray-100" aria-label="Konto">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-6 w-6">
						<path stroke-linecap="round" stroke-linejoin="round" d={userIcon} />
					</svg>
				</a>
			</header>

			<!-- Inhalt; unten Platz für die Bottom-Nav auf Mobile -->
			<main class="flex-1 p-4 pb-24 md:p-8 md:pb-8">
				{@render children()}
			</main>

			<!-- Bottom-Nav (Mobile) -->
			<nav
				class="fixed inset-x-0 bottom-0 z-10 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				{#snippet navLink(item: (typeof navItems)[number])}
					<a
						href={item.href}
						class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium
							{isActive(item.href) ? 'text-green-700' : 'text-gray-500'}"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-6 w-6">
							<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
						</svg>
						{item.label}
					</a>
				{/snippet}
				{#each navItems.slice(0, 2) as item (item.href)}
					{@render navLink(item)}
				{/each}
				<!-- Mittiger, hervorgehobener Scan-Button -->
				<a href="/scan" aria-label="Scannen" class="relative -top-3 flex flex-1 flex-col items-center">
					<span class="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-7 w-7">
							<path stroke-linecap="round" stroke-linejoin="round" d={scanIcon} />
						</svg>
					</span>
				</a>
				{#each navItems.slice(2) as item (item.href)}
					{@render navLink(item)}
				{/each}
			</nav>
		</div>
	</div>
{/if}
