import * as cheerio from 'cheerio';
import type { Block } from '$lib/types';

interface BioRxivApiResponse {
	collection: Array<{
		doi: string;
		title: string;
		authors: string;
		author_corresponding: string;
		author_corresponding_institution: string;
		date: string;
		version: string;
		type: string;
		license: string;
		category: string;
		jatsxml: string;
		abstract: string;
		published: string;
		server: string;
	}>;
	messages: Array<{
		status: string;
		count: number;
	}>;
}

/**
 * Extract the DOI from a bioRxiv URL
 */
export function extractDoiFromUrl(url: string): string | null {
	const match = url.match(/10\.\d{4,}\/[^\s/?#]+/);
	return match ? match[0] : null;
}

/**
 * Fetch paper details from the bioRxiv API
 */
export async function fetchPaperDetails(
	doi: string
): Promise<BioRxivApiResponse['collection'][0] | null> {
	try {
		const apiUrl = `https://api.biorxiv.org/details/biorxiv/${doi}/na/json`;
		const response = await fetch(apiUrl);

		if (!response.ok) {
			console.error(`bioRxiv API returned ${response.status}`);
			return null;
		}

		const data = (await response.json()) as BioRxivApiResponse;

		if (!data.collection || data.collection.length === 0) {
			console.error('No paper found in bioRxiv API response');
			return null;
		}

		return data.collection[0];
	} catch (error) {
		console.error('Error fetching from bioRxiv API:', error);
		return null;
	}
}

/**
 * Fetch the JATS XML content for a paper
 */
export async function fetchJatsXml(jatsPath: string): Promise<string | null> {
	try {
		// The jatsxml field contains just the path, need to construct full URL
		const jatsUrl = jatsPath.startsWith('http') ? jatsPath : `https://www.biorxiv.org${jatsPath}`;

		const response = await fetch(jatsUrl, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				Accept: 'application/xml, text/xml, */*'
			}
		});

		if (!response.ok) {
			console.error(`Failed to fetch JATS XML from ${jatsUrl}: ${response.status}`);
			return null;
		}

		return await response.text();
	} catch (error) {
		console.error('Error fetching JATS XML:', error);
		return null;
	}
}

/**
 * Extract metadata from API response
 */
export function extractMetadataFromApi(details: BioRxivApiResponse['collection'][0]): {
	title: string;
	authors: string[];
} {
	const authors = details.authors
		.split(';')
		.map((a) => a.trim())
		.filter((a) => a.length > 0);

	return {
		title: details.title,
		authors
	};
}

/**
 * Parse JATS XML into structured blocks
 * Handles various bioRxiv XML structures
 */
export function parseJatsXmlToBlocks(xml: string): Block[] {
	const $ = cheerio.load(xml, { xmlMode: true });
	const blocks: Block[] = [];
	let paraCounter = 0;
	let figureCounter = 0;

	// Helper to process a section recursively
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function processSection($sec: cheerio.Cheerio<any>) {
		// Get section title
		const sectionTitle = $sec.find('> title').first().text().trim();
		if (sectionTitle && !sectionTitle.toLowerCase().includes('reference')) {
			// Determine heading level based on nesting
			const nestingLevel = $sec.parents('sec').length;
			blocks.push({
				kind: 'heading',
				level: nestingLevel === 0 ? 2 : 3,
				text: sectionTitle
			});
		}

		// Process direct child elements in order to maintain structure
		$sec.children().each((_, child) => {
			const $child = $(child);
			const tagName = child.tagName?.toLowerCase();

			if (tagName === 'p') {
				const text = getTextContent($, $child);
				if (text && text.length > 20) {
					blocks.push({
						kind: 'para',
						id: `p${paraCounter++}`,
						text_html: text
					});
				}
			} else if (tagName === 'fig') {
				const figBlock = extractFigure($, $child, figureCounter++);
				if (figBlock) {
					blocks.push(figBlock);
				}
			} else if (tagName === 'sec') {
				// Recursively process nested sections
				processSection($child);
			}
		});
	}

	// Try multiple XML structures bioRxiv might use
	// Structure 1: article > body > sec
	const bodySections = $('body > sec');
	if (bodySections.length > 0) {
		bodySections.each((_, section) => {
			processSection($(section));
		});
	} else {
		// Structure 2: Try direct body paragraphs
		$('body > p').each((_, p) => {
			const text = getTextContent($, $(p));
			if (text && text.length > 20) {
				blocks.push({
					kind: 'para',
					id: `p${paraCounter++}`,
					text_html: text
				});
			}
		});
	}

	// Process figures in floats-group (common in JATS)
	$('floats-group fig, body fig').each((_, fig) => {
		const $fig = $(fig);
		// Check if already processed (has an id we've seen)
		const figId = $fig.attr('id');
		const alreadyAdded = blocks.some((b) => b.kind === 'figure' && b.id === figId);
		if (!alreadyAdded) {
			const figBlock = extractFigure($, $fig, figureCounter++);
			if (figBlock) {
				blocks.push(figBlock);
			}
		}
	});

	console.log(
		`Parsed ${blocks.length} blocks from JATS XML (${blocks.filter((b) => b.kind === 'para').length} paragraphs)`
	);

	return blocks;
}

/**
 * Get text content from a JATS paragraph, handling nested elements
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTextContent($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): string {
	// Clone to avoid modifying original
	const $clone = $el.clone();

	// Remove xref elements (citations) but keep their text for context
	$clone.find('xref[ref-type="bibr"]').each((_, el) => {
		$(el).replaceWith('');
	});

	// Get text, preserving some structure
	let text = $clone.text().trim();

	// Clean up multiple spaces
	text = text.replace(/\s+/g, ' ');

	return text;
}

/**
 * Extract figure data from a JATS fig element
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFigure(
	$: cheerio.CheerioAPI,
	$fig: cheerio.Cheerio<any>,
	counter: number
): Block | null {
	const $graphic = $fig.find('graphic').first();
	const href = $graphic.attr('xlink:href') || $graphic.attr('href');

	if (!href) return null;

	// Construct image URL - bioRxiv uses highwire CDN
	const imgUrl = href.startsWith('http')
		? href
		: `https://www.biorxiv.org/content/biorxiv/early/${href}`;

	const label = $fig.find('label').first().text().trim();
	const caption = $fig.find('caption').first().text().trim();

	return {
		kind: 'figure',
		id: `fig${counter}`,
		img_url: imgUrl,
		caption_html: caption,
		label: label || undefined
	};
}

/**
 * Validate that a URL is a bioRxiv URL
 */
export function isBioRxivUrl(url: string): boolean {
	return /biorxiv\.org\/content\/10\.\d{4,}/.test(url);
}

/**
 * Generate a stable paper ID from the DOI
 */
export function generatePaperId(doi: string): string {
	return `biorxiv:${doi}`;
}

/**
 * Main function to fetch and parse a bioRxiv paper
 */
export async function fetchAndParsePaper(url: string): Promise<{
	doi: string;
	title: string;
	authors: string[];
	blocks: Block[];
	abstract: string;
} | null> {
	// Extract DOI from URL
	const doi = extractDoiFromUrl(url);
	if (!doi) {
		console.error('Could not extract DOI from URL');
		return null;
	}

	// Fetch paper details from API
	const details = await fetchPaperDetails(doi);
	if (!details) {
		return null;
	}

	// Extract metadata
	const { title, authors } = extractMetadataFromApi(details);

	// Fetch JATS XML
	const jatsXml = await fetchJatsXml(details.jatsxml);
	if (!jatsXml) {
		// Fall back to using abstract only if JATS not available
		// Split abstract into paragraphs for better processing
		const abstractParagraphs = details.abstract
			.split(/\n\n|\r\n\r\n/)
			.filter((p) => p.trim().length > 0);

		const blocks: Block[] = [
			{
				kind: 'heading',
				level: 2,
				text: 'Abstract'
			}
		];

		abstractParagraphs.forEach((para, i) => {
			blocks.push({
				kind: 'para',
				id: `p${i}`,
				text_html: para.trim()
			});
		});

		// Add a note about full-text
		blocks.push({
			kind: 'heading',
			level: 2,
			text: 'Note'
		});
		blocks.push({
			kind: 'para',
			id: 'note',
			text_html:
				'The full text of this paper is currently unavailable for automated processing. This explanation covers the abstract only. For the complete paper, please visit the original on bioRxiv.'
		});

		return {
			doi,
			title,
			authors,
			blocks,
			abstract: details.abstract
		};
	}

	// Parse JATS XML into blocks
	const blocks = parseJatsXmlToBlocks(jatsXml);

	// Add abstract at the beginning if not already there
	if (details.abstract && blocks.length > 0) {
		blocks.unshift(
			{
				kind: 'heading',
				level: 2,
				text: 'Abstract'
			},
			{
				kind: 'para',
				id: 'abstract',
				text_html: details.abstract
			}
		);
	}

	return {
		doi,
		title,
		authors,
		blocks,
		abstract: details.abstract
	};
}
