import type { Term } from '$lib/types';

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format abstract section labels with line breaks and bold text
 * Handles patterns like "Significance:", "Aim:", "Approach:", "Results:", "Conclusions:"
 */
export function formatAbstractLabels(text: string): string {
	// Common abstract section labels (case-insensitive)
	const labels = [
		'Significance',
		'Aim',
		'Aims',
		'Approach',
		'Methods',
		'Method',
		'Results',
		'Result',
		'Conclusions',
		'Conclusion',
		'Background',
		'Objective',
		'Objectives',
		'Purpose',
		'Design',
		'Findings',
		'Interpretation',
		'Funding'
	];

	// Create regex pattern to match any label followed by colon
	const pattern = new RegExp(`(${labels.join('|')})\\s*:`, 'gi');

	let isFirst = true;
	return text.replace(pattern, (match, label) => {
		const formatted = `<strong>${label}:</strong>`;
		if (isFirst) {
			isFirst = false;
			return formatted;
		}
		// Add line break before subsequent labels
		return `<br><br>${formatted}`;
	});
}

/**
 * Highlights terms in text by wrapping them in clickable buttons
 * Uses longest-first matching to avoid partial matches
 */
export function highlightTerms(text: string, terms: Record<string, Term>): string {
	if (!text || Object.keys(terms).length === 0) {
		return text;
	}

	// Sort terms by length (longest first) to avoid partial matches
	const sortedEntries = Object.entries(terms).sort(([, a], [, b]) => b.term.length - a.term.length);

	// Create a map of placeholder tokens to term data
	const placeholders: Map<string, { termId: string; originalMatch: string }> = new Map();
	let placeholderCounter = 0;
	let result = text;

	for (const [termId, termData] of sortedEntries) {
		// Create a case-insensitive regex that matches whole words
		const regex = new RegExp(`\\b(${escapeRegex(termData.term)})\\b`, 'gi');

		result = result.replace(regex, (match) => {
			const placeholder = `__TERM_PLACEHOLDER_${placeholderCounter++}__`;
			placeholders.set(placeholder, { termId, originalMatch: match });
			return placeholder;
		});
	}

	// Replace placeholders with actual HTML buttons
	for (const [placeholder, { termId, originalMatch }] of placeholders) {
		const buttonHtml = `<button class="term-highlight" data-term-id="${termId}">${originalMatch}</button>`;
		result = result.replace(placeholder, buttonHtml);
	}

	return result;
}

/**
 * Get all term IDs that appear in a piece of text
 */
export function getTermIdsInText(text: string, terms: Record<string, Term>): string[] {
	const foundTermIds: string[] = [];

	for (const [termId, termData] of Object.entries(terms)) {
		const regex = new RegExp(`\\b${escapeRegex(termData.term)}\\b`, 'gi');
		if (regex.test(text)) {
			foundTermIds.push(termId);
		}
	}

	return foundTermIds;
}
