import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { Block, PlainBlock, Term } from '$lib/types';

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY
});

const SYSTEM_PROMPT = `You are rewriting a scientific paper paragraph.

Imagine the original researcher is rewriting their own work for a smart friend who isn't in the field. The voice stays the same - same structure, same meaning. You're just removing jargon and making it clear.

Rules:
- Keep the exact same meaning and structure
- Keep all numbers, units, and statistics exactly as written
- Keep uncertainty language (suggests, may, consistent with, appears to)
- Don't add interpretations or conclusions not in the original
- Don't turn correlations into causations
- Some technical terms MUST stay in the text (like gene names, protein names, methods) - keep these but mark them for definition
- Preserve the researcher's voice and perspective

For the terms list: identify 2-5 technical terms that APPEAR IN YOUR REWRITTEN TEXT that a non-scientist would benefit from having explained. The term field must be an exact substring of your rewritten paragraph.`;

interface RewriteResult {
	plain: string;
	terms: Array<{ term: string; simple: string }>;
}

/**
 * Strip HTML tags from text for processing
 */
function stripHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Rewrite a single paragraph using OpenAI
 */
export async function rewriteParagraph(textHtml: string): Promise<RewriteResult> {
	const plainText = stripHtml(textHtml);

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini', // Cheapest GPT-4 class model
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{
					role: 'user',
					content: `Please rewrite this paragraph in plain English and identify key terms:

"${plainText}"

Respond in JSON format:
{
  "plain": "the rewritten paragraph",
  "terms": [
    { "term": "original term", "simple": "plain English explanation" }
  ]
}`
				}
			],
			response_format: { type: 'json_object' },
			temperature: 0.3
		});

		const content = response.choices[0]?.message?.content;
		if (!content) {
			throw new Error('No response from OpenAI');
		}

		const result = JSON.parse(content) as RewriteResult;
		return result;
	} catch (error) {
		console.error('Error rewriting paragraph:', error);
		// Fallback: return original text with no terms
		return {
			plain: plainText,
			terms: []
		};
	}
}

/**
 * Rewrite all paragraphs in a paper's blocks
 */
export async function rewriteAllBlocks(
	blocks: Block[]
): Promise<{ plainBlocks: PlainBlock[]; terms: Record<string, Term> }> {
	const plainBlocks: PlainBlock[] = [];
	const allTerms: Record<string, Term> = {};
	let termCounter = 0;

	for (const block of blocks) {
		if (block.kind === 'heading') {
			plainBlocks.push({
				kind: 'heading',
				level: block.level,
				text: block.text
			});
		} else if (block.kind === 'figure') {
			plainBlocks.push({
				kind: 'figure',
				id: block.id
			});
		} else if (block.kind === 'para') {
			const result = await rewriteParagraph(block.text_html);

			// Process terms and assign IDs
			const termIds: string[] = [];
			for (const term of result.terms) {
				// Check if we already have this term (case-insensitive)
				const existingKey = Object.keys(allTerms).find(
					(k) => allTerms[k].term.toLowerCase() === term.term.toLowerCase()
				);

				if (existingKey) {
					termIds.push(existingKey);
				} else {
					const termId = `t${termCounter++}`;
					allTerms[termId] = {
						term: term.term,
						simple: term.simple
					};
					termIds.push(termId);
				}
			}

			plainBlocks.push({
				kind: 'para',
				id: block.id,
				text: result.plain,
				term_ids: termIds
			});
		}
	}

	return { plainBlocks, terms: allTerms };
}
