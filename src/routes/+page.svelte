<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let url = $state('');
	let copied = $state(false);
	let shareableCopied = $state(false);

	const exampleUrl = 'https://www.biorxiv.org/content/10.1101/213827';

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!url.trim()) return;

		// Extract the URL path after the protocol
		const cleanUrl = url.replace(/^https?:\/\//, '');
		goto(`/${cleanUrl}`);
	}

	async function copyExample() {
		await navigator.clipboard.writeText(exampleUrl);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function tryExample() {
		url = exampleUrl;
	}

	const shareableLink = $derived.by(() => {
		const cleanUrl = exampleUrl.replace(/^https?:\/\//, '');
		const baseUrl = $page.url.origin;
		return `${baseUrl}/${cleanUrl}`;
	});

	async function copyShareableLink() {
		await navigator.clipboard.writeText(shareableLink);
		shareableCopied = true;
		setTimeout(() => (shareableCopied = false), 2000);
	}
</script>

<main class="min-h-screen bg-background text-foreground font-sans">
	<div class="mx-auto max-w-2xl px-6 py-24">
		<header class="mb-16 text-center">
			<h1 class="mb-4 text-4xl font-medium tracking-tight">
				Read scientific papers without the jargon
			</h1>
			<p class="text-lg text-muted-foreground">
				Get plain-English explanations that show what changed, why it matters, and what it enables.
				Technical terms become hoverable definitions.
			</p>
		</header>

		<div class="mb-8 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
			<p class="mb-2 font-medium text-foreground">Important notes:</p>
			<ul class="list-inside list-disc space-y-1">
				<li>
					Currently, only <strong>abstracts</strong> are available. Full text access requires additional setup due to access restrictions.
				</li>
				<li>
					Please use this tool responsibly. Each explanation uses AI processing that incurs costs.
				</li>
			</ul>
		</div>

		<form onsubmit={handleSubmit} class="mb-8">
			<div class="flex flex-col gap-4">
				<label for="url" class="sr-only">bioRxiv URL</label>
				<input
					id="url"
					type="url"
					bind:value={url}
					placeholder="https://www.biorxiv.org/content/10.1101/..."
					class="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring overflow-x-auto"
				/>
				<button
					type="submit"
					disabled={!url.trim()}
					class="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Explain this paper
				</button>
			</div>
		</form>

		<div class="flex items-center justify-center gap-4 text-sm">
			<button
				onclick={tryExample}
				class="text-muted-foreground underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:text-foreground"
			>
				Try an example
			</button>
			<span class="text-muted-foreground">or</span>
			<button
				onclick={copyExample}
				class="text-muted-foreground underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:text-foreground"
			>
				{copied ? 'Copied!' : 'Copy example URL'}
			</button>
		</div>

		<div class="mt-12 rounded-lg border border-border bg-muted/30 px-4 sm:px-6 py-5">
			<h2 class="mb-3 text-lg font-medium text-foreground">Share links directly</h2>
			<p class="mb-4 text-sm text-muted-foreground">
				You don't need to visit this page first. Just prepend this site's URL to any bioRxiv URL, and
				it will automatically open the explained version. Perfect for sharing accessible papers with
				colleagues.
			</p>
			<div class="mb-4 rounded-md bg-background px-3 py-2 font-mono text-xs text-foreground break-all overflow-x-auto min-w-0">
				{shareableLink}
			</div>
			<button
				onclick={copyShareableLink}
				class="text-sm text-muted-foreground underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:text-foreground"
			>
				{shareableCopied ? 'Copied!' : 'Copy shareable link'}
			</button>
		</div>

		<footer class="mt-24 text-center text-sm text-muted-foreground">
			<p>
				Numbers and uncertainty stay accurate.
				<br />
				Understand what changed, why it matters, and what it enables.
			</p>
		</footer>
	</div>
</main>
