import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchAndParsePaper, isBioRxivUrl, generatePaperId } from '../../[...wrapped]/biorxiv';
import { rewriteAllBlocks } from '../../[...wrapped]/rewriter';
import { db, papers } from '$lib/db';
import { eq } from 'drizzle-orm';
import type { Paper } from '$lib/types';

interface ProgressEvent {
	stage: string;
	message: string;
	progress: number;
	subProgress?: string;
}

function sendProgress(controller: ReadableStreamDefaultController, event: ProgressEvent) {
	const data = JSON.stringify(event);
	controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
}

export const GET: RequestHandler = async ({ url }) => {
	const bioRxivUrl = url.searchParams.get('url');

	if (!bioRxivUrl) {
		error(400, 'Missing bioRxiv URL');
	}

	// Validate it's a bioRxiv URL
	if (!isBioRxivUrl(bioRxivUrl)) {
		error(400, 'Invalid bioRxiv URL');
	}

	// Set up SSE stream
	const stream = new ReadableStream({
		async start(controller) {
			try {
				// Check cache first
				const doi = bioRxivUrl.match(/10\.\d{4,}\/[^\s/?#]+/)?.[0];
				if (doi) {
					const paperId = generatePaperId(doi);
					const cached = await db.select().from(papers).where(eq(papers.id, paperId)).limit(1);

					if (cached.length > 0 && cached[0].data) {
						sendProgress(controller, {
							stage: 'complete',
							message: 'Paper loaded from cache',
							progress: 100
						});
						const data = JSON.stringify({ status: 'ready', paper: cached[0].data });
						controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
						controller.close();
						return;
					}
				}

				// Stage 1: Fetching paper (0-15%)
				sendProgress(controller, {
					stage: 'fetching',
					message: 'Fetching paper from bioRxiv...',
					progress: 5
				});

				const paperData = await fetchAndParsePaper(bioRxivUrl);

				if (!paperData) {
					const errorData = JSON.stringify({
						status: 'error',
						message:
							'Could not fetch this paper from bioRxiv. The paper may not exist or the API may be temporarily unavailable.'
					});
					controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`));
					controller.close();
					return;
				}

				sendProgress(controller, {
					stage: 'fetching',
					message: 'Paper fetched successfully',
					progress: 15
				});

				// Stage 2: Parsing content (15-25%)
				sendProgress(controller, {
					stage: 'parsing',
					message: 'Parsing paper content...',
					progress: 20
				});

				if (paperData.blocks.length === 0) {
					const errorData = JSON.stringify({
						status: 'error',
						message: 'Could not parse paper content. The paper structure may not be supported.'
					});
					controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`));
					controller.close();
					return;
				}

				sendProgress(controller, {
					stage: 'parsing',
					message: `Parsed ${paperData.blocks.length} content blocks`,
					progress: 25
				});

				// Stage 3: Rewriting content (25-95%)
				const paragraphBlocks = paperData.blocks.filter((b) => b.kind === 'para');
				const totalParagraphs = paragraphBlocks.length;
				let processedParagraphs = 0;

				sendProgress(controller, {
					stage: 'rewriting',
					message: `Rewriting ${totalParagraphs} paragraphs...`,
					progress: 25,
					subProgress: `0 of ${totalParagraphs}`
				});

				const { plainBlocks, terms } = await rewriteAllBlocks(paperData.blocks, (index, total) => {
					processedParagraphs++;
					const progress = 25 + Math.floor((processedParagraphs / total) * 70);
					sendProgress(controller, {
						stage: 'rewriting',
						message: `Rewriting paragraph ${processedParagraphs} of ${total}...`,
						progress,
						subProgress: `${processedParagraphs} of ${total}`
					});
				});

				// Stage 4: Saving (95-100%)
				sendProgress(controller, {
					stage: 'saving',
					message: 'Saving to cache...',
					progress: 95
				});

				const paperId = generatePaperId(paperData.doi);
				const paper: Paper = {
					id: paperId,
					sourceUrl: bioRxivUrl,
					title: paperData.title,
					authors: paperData.authors,
					blocks: paperData.blocks,
					plain: {
						blocks: plainBlocks,
						terms
					}
				};

				await db
					.insert(papers)
					.values({
						id: paperId,
						sourceUrl: bioRxivUrl,
						data: paper
					})
					.onConflictDoUpdate({
						target: papers.id,
						set: {
							data: paper
						}
					});

				sendProgress(controller, {
					stage: 'complete',
					message: 'Processing complete!',
					progress: 100
				});

				// Send final result
				const resultData = JSON.stringify({ status: 'ready', paper });
				controller.enqueue(new TextEncoder().encode(`data: ${resultData}\n\n`));
				controller.close();
			} catch (err) {
				console.error('Error processing paper:', err);
				const errorData = JSON.stringify({
					status: 'error',
					message: err instanceof Error ? err.message : 'An unexpected error occurred'
				});
				controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`));
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};

