<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const navItems = [
		{
			href: '/',
			label: 'Lager',
			// Heroicons: archive-box
			icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z'
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
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-dvh bg-gray-50 text-gray-900 md:flex">
	<!-- Sidebar (Desktop) -->
	<aside class="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
		<div class="flex items-center gap-2 px-4 py-5">
			<img src="/icon.svg" alt="" class="h-8 w-8" />
			<span class="text-lg font-bold">LebensmittelKumpel</span>
		</div>
		<nav class="flex flex-col gap-1 px-2">
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
		</nav>
	</aside>

	<div class="flex min-h-dvh flex-1 flex-col">
		<!-- Header (Mobile) -->
		<header class="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
			<img src="/icon.svg" alt="" class="h-7 w-7" />
			<span class="text-base font-bold">LebensmittelKumpel</span>
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
