<script lang="ts">
	import { Circle } from 'svelte-loading-spinners';
	import GlossaryPanel from './GlossaryPanel.svelte';
	import { highlightTerms, formatAbstractLabels } from './term-highlighter';
	import type { PageData } from './$types';
	import type { Paper } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let activeTermId = $state<string | null>(null);
	let processingData = $state<{
		stage: string;
		message: string;
		progress: number;
		subProgress?: string;
	} | null>(null);
	let processedPaper = $state<Paper | null>(null);
	let processingError = $state<string | null>(null);

	// Subscribe to SSE when processing
	$effect(() => {
		if (data.status === 'processing' && 'bioRxivUrl' in data && data.bioRxivUrl) {
			const eventSource = new EventSource(`/api/process?url=${encodeURIComponent(data.bioRxivUrl)}`);

			eventSource.onmessage = (event) => {
				try {
					const parsed = JSON.parse(event.data);

					// Handle progress updates
					if (parsed.stage && parsed.message && typeof parsed.progress === 'number') {
						processingData = {
							stage: parsed.stage,
							message: parsed.message,
							progress: parsed.progress,
							subProgress: parsed.subProgress
						};
					}

					// Handle completion
					if (parsed.status === 'ready' && parsed.paper) {
						processedPaper = parsed.paper;
						eventSource.close();
					}

					// Handle errors
					if (parsed.status === 'error') {
						processingError = parsed.message || 'An error occurred while processing the paper';
						eventSource.close();
					}
				} catch (err) {
					console.error('Error parsing SSE message:', err);
				}
			};

			eventSource.onerror = () => {
				if (!processedPaper && !processingError) {
					processingError = 'Connection lost. Please try again.';
				}
				eventSource.close();
			};

			return () => {
				eventSource.close();
			};
		}
	});

	function handleTermClick(event: MouseEvent | KeyboardEvent) {
		const target = event.target as HTMLElement;
		if (target.classList.contains('term-highlight')) {
			// For keyboard events, only trigger on Enter or Space
			if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
				return;
			}
			const termId = target.dataset.termId;
			if (termId) {
				activeTermId = termId;
			}
		}
	}

	function getBlockKey(block: { kind: string; id?: string; text?: string }, index: number): string {
		if (block.kind === 'heading') return `h-${index}-${(block.text || '').slice(0, 20)}`;
		return block.id || `block-${index}`;
	}

	function closeGlossary() {
		activeTermId = null;
	}

	// Get the original figure block by ID
	function getOriginalFigure(figureId: string) {
		const paper = data.status === 'ready' ? data.paper : processedPaper;
		if (!paper) return null;
		return paper.blocks.find((b) => b.kind === 'figure' && b.id === figureId);
	}

	// Get the current paper (either from data or processed)
	const currentPaper = $derived(
		data.status === 'ready' ? data.paper : processedPaper
	);

	// Get stage display name
	function getStageDisplayName(stage: string): string {
		switch (stage) {
			case 'fetching':
				return 'Fetching paper';
			case 'parsing':
				return 'Parsing content';
			case 'rewriting':
				return 'Rewriting content';
			case 'saving':
				return 'Saving';
			case 'complete':
				return 'Complete';
			default:
				return 'Processing';
		}
	}
</script>

<svelte:head>
	{#if data.status === 'ready' || processedPaper}
		<title>{currentPaper?.title || 'Loading...'} | Explained</title>
	{:else}
		<title>Processing... | Paper Explainer</title>
	{/if}
</svelte:head>

{#if data.status === 'pending' || processingError}
	<!-- Error/Pending state -->
	<main class="flex min-h-screen flex-col items-center justify-center bg-background p-6 font-sans">
		<div class="text-center">
			<h1 class="mb-4 text-2xl font-medium text-foreground">Indexing New Article</h1>
			<p class="mb-8 max-w-md text-muted-foreground">
				{processingError || data.message || 'An error occurred'}
			</p>
			<a href="/" class="inline-block text-foreground underline underline-offset-4">
				← Try another paper
			</a>
		</div>
	</main>
{:else if data.status === 'processing' && !processedPaper}
	<!-- Processing state with progress bar -->
	<main class="flex min-h-screen flex-col items-center justify-center bg-background p-6 font-sans">
		<div class="w-full max-w-md">
			<div class="text-center mb-8">
				<h1 class="mb-4 text-2xl font-medium text-foreground">Processing Your Paper</h1>
			</div>

			{#if processingData}
				<div class="mb-6">
					<div class="flex items-center justify-between mb-2">
						<span class="text-sm font-medium text-foreground">
							{getStageDisplayName(processingData.stage)}
						</span>
						<span class="text-sm text-muted-foreground">{processingData.progress}%</span>
					</div>
					<div class="w-full h-2 bg-muted rounded-full overflow-hidden">
						<div
							class="h-full bg-primary transition-all duration-300 ease-out"
							style="width: {processingData.progress}%"
						></div>
					</div>
					{#if processingData.subProgress}
						<p class="mt-2 text-sm text-muted-foreground">{processingData.subProgress}</p>
					{:else}
						<p class="mt-2 text-sm text-muted-foreground">{processingData.message}</p>
					{/if}
				</div>
			{:else}
				<div class="mb-6 text-center">
					<Circle size="40" color="var(--foreground)" unit="px" duration="1.5s" />
					<p class="mt-4 text-sm text-muted-foreground">Starting...</p>
				</div>
			{/if}

			<div class="text-center">
				<a href="/" class="inline-block text-foreground underline underline-offset-4">
					← Try another paper
				</a>
			</div>
		</div>
	</main>
{:else if data.status === 'ready' || processedPaper}
	<!-- Ready state -->
	<main
		class="min-h-screen bg-background font-sans transition-all duration-300 {activeTermId
			? 'mr-96'
			: ''}"
	>
		<article class="mx-auto max-w-3xl px-6 py-12">
			<!-- Header -->
			{#if currentPaper}
				<header class="mb-12 border-b border-border pb-8">
					<a
						href="/"
						class="mb-6 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						← Back to home
					</a>
					<h1 class="mb-4 text-3xl font-medium leading-tight text-foreground">
						{currentPaper.title}
					</h1>
					<p class="text-muted-foreground">
						{currentPaper.authors.join(', ')}
					</p>
					<a
						href={currentPaper.sourceUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="mt-4 inline-block text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
					>
						View original on bioRxiv ↗
					</a>
				</header>
			{/if}

			<!-- Content -->
			{#if currentPaper}
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div class="prose-content" onclick={handleTermClick} onkeydown={handleTermClick} role="article">
					{#each currentPaper.plain.blocks as block, index (getBlockKey(block, index))}
					{#if block.kind === 'heading'}
						{#if block.level === 2}
							<h2 class="mb-4 mt-10 text-xl font-medium text-foreground">
								{block.text}
							</h2>
						{:else}
							<h3 class="mb-3 mt-8 text-lg font-medium text-foreground">
								{block.text}
							</h3>
						{/if}
					{:else if block.kind === 'para'}
						<p class="mb-6 leading-relaxed text-foreground">
							{@html highlightTerms(formatAbstractLabels(block.text), currentPaper.plain.terms)}
						</p>
					{:else if block.kind === 'figure'}
						{@const figure = getOriginalFigure(block.id)}
						{#if figure && figure.kind === 'figure'}
							<figure class="my-10 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
								<img
									src="/api/img?u={encodeURIComponent(figure.img_url)}"
									alt={figure.label || 'Figure'}
									class="w-full"
									loading="lazy"
								/>
								{#if figure.caption_html}
									<figcaption class="border-t border-border bg-muted/50 px-6 py-4 text-sm">
										{#if figure.label}
											<strong class="text-foreground">{figure.label}</strong>
										{/if}
										<span class="text-muted-foreground">
											{@html figure.caption_html}
										</span>
									</figcaption>
								{/if}
							</figure>
						{/if}
					{/if}
					{/each}
				</div>

				<!-- Footer -->
				<footer class="mt-16 border-t border-border pt-8 text-center text-sm text-muted-foreground">
					<p>
						This is a simplified version of the original paper. Numbers, statistics, and uncertainty
						language are preserved.
					</p>
					<a
						href={currentPaper.sourceUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="mt-2 inline-block underline underline-offset-4 transition-colors hover:text-foreground"
					>
						Read the original paper →
					</a>
				</footer>
			{/if}
		</article>

		<!-- Glossary Panel -->
		{#if currentPaper}
			<GlossaryPanel 
				terms={currentPaper.plain.terms} 
				{activeTermId} 
				onClose={closeGlossary} 
				onSelectTerm={(termId) => activeTermId = termId}
			/>
		{/if}
	</main>
{/if}

<style>
	:global(.term-highlight) {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: var(--muted-foreground);
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
		transition: text-decoration-color 0.15s ease;
	}

	:global(.term-highlight:hover) {
		text-decoration-color: var(--foreground);
	}
</style>

