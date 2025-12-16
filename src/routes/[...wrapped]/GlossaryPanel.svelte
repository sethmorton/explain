<script lang="ts">
	import type { Term } from '$lib/types';

	interface Props {
		terms: Record<string, Term>;
		activeTermId: string | null;
		onClose: () => void;
		onSelectTerm: (termId: string) => void;
	}

	let { terms, activeTermId, onClose, onSelectTerm }: Props = $props();

	let activeTerm = $derived(activeTermId ? terms[activeTermId] : null);
</script>

<div
	class="fixed right-0 top-0 z-50 h-full w-96 max-w-[90vw] transform bg-card shadow-xl transition-transform duration-300 ease-out {activeTermId
		? 'translate-x-0'
		: 'translate-x-full'}"
>
	<div class="flex h-full flex-col border-l border-border">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-border px-6 py-4">
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">Glossary</h2>
			<button
				onclick={onClose}
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Close glossary"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6">
			{#if activeTerm}
				<div class="space-y-4">
					<h3 class="text-xl font-medium text-card-foreground">
						{activeTerm.term}
					</h3>
					<p class="text-base leading-relaxed text-card-foreground">
						{activeTerm.simple}
					</p>
					{#if activeTerm.more}
						<div class="mt-4 rounded-lg bg-muted p-4">
							<p class="text-sm text-muted-foreground">
								{activeTerm.more}
							</p>
						</div>
					{/if}
				</div>
			{:else}
				<p class="text-muted-foreground">Click on an underlined term to see its definition.</p>
			{/if}
		</div>

		<!-- All terms list -->
		{#if Object.keys(terms).length > 0}
			<div class="border-t border-border px-6 py-4">
				<h4 class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
					All terms in this paper
				</h4>
				<div class="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
					{#each Object.entries(terms) as [termId, term] (termId)}
						<button
							onclick={() => onSelectTerm(termId)}
							class="rounded-md border border-border px-2 py-1 text-sm transition-colors {activeTermId ===
							termId
								? 'bg-primary text-primary-foreground'
								: 'bg-background text-foreground hover:bg-muted'}"
						>
							{term.term}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Backdrop -->
{#if activeTermId}
	<button
		class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
		onclick={onClose}
		aria-label="Close glossary"
	></button>
{/if}

