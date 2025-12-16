import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const imgUrl = url.searchParams.get('u');

	if (!imgUrl) {
		return new Response('Missing image URL', { status: 400 });
	}

	// Validate it's a bioRxiv image URL
	if (!imgUrl.includes('biorxiv.org') && !imgUrl.includes('highwire')) {
		return new Response('Invalid image source', { status: 403 });
	}

	try {
		const response = await fetch(imgUrl, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (compatible; BioRxivExplainer/1.0; +https://github.com/explain)',
				Accept: 'image/*',
				Referer: 'https://www.biorxiv.org/'
			}
		});

		if (!response.ok) {
			return new Response('Failed to fetch image', { status: response.status });
		}

		const contentType = response.headers.get('Content-Type') || 'image/png';
		const buffer = await response.arrayBuffer();

		return new Response(buffer, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch (error) {
		console.error('Error proxying image:', error);
		return new Response('Failed to fetch image', { status: 500 });
	}
};

