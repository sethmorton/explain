import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, papers } from '$lib/db';
import type { Paper } from '$lib/types';
import { fetchAndParsePaper, isBioRxivUrl, generatePaperId } from './biorxiv';
import { rewriteAllBlocks } from './rewriter';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	// Extract URL from path (prefer) or query param
	const wrapped = params.wrapped;
	const queryUrl = url.searchParams.get('u');

	let bioRxivUrl: string;

	if (wrapped) {
		// Path format: /www.biorxiv.org/content/...
		bioRxivUrl = `https://${wrapped}`;
	} else if (queryUrl) {
		// Query param format: /?u=https://...
		bioRxivUrl = queryUrl;
	} else {
		error(400, 'No bioRxiv URL provided');
	}

	// Validate it's a bioRxiv URL
	if (!isBioRxivUrl(bioRxivUrl)) {
		error(400, 'Invalid bioRxiv URL. Please provide a valid bioRxiv paper URL.');
	}

	// Fetch and parse the paper using the bioRxiv API
	const paperData = await fetchAndParsePaper(bioRxivUrl);

	if (!paperData) {
		return {
			status: 'pending' as const,
			message:
				'Could not fetch this paper from bioRxiv. The paper may not exist or the API may be temporarily unavailable. Please try again later.'
		};
	}

	const paperId = generatePaperId(paperData.doi);

	// Check for force refresh param
	const forceRefresh = url.searchParams.get('refresh') === 'true';

	// Check cache first (unless force refresh)
	if (!forceRefresh) {
		const cached = await db.select().from(papers).where(eq(papers.id, paperId)).limit(1);

		if (cached.length > 0 && cached[0].data) {
			return {
				status: 'ready' as const,
				paper: cached[0].data as Paper
			};
		}
	}

	if (paperData.blocks.length === 0) {
		error(500, 'Could not parse paper content. The paper structure may not be supported.');
	}

	// Return processing state - client will handle SSE streaming
	return {
		status: 'processing' as const,
		bioRxivUrl
	};
};
