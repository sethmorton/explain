export type Block =
	| { kind: 'heading'; level: 2 | 3; text: string }
	| { kind: 'para'; id: string; text_html: string }
	| { kind: 'figure'; id: string; img_url: string; caption_html: string; label?: string };

export type PlainBlock =
	| { kind: 'heading'; level: 2 | 3; text: string }
	| { kind: 'para'; id: string; text: string; term_ids: string[] }
	| { kind: 'figure'; id: string };

export type Term = {
	term: string;
	simple: string;
	more?: string;
};

export type Paper = {
	id: string;
	sourceUrl: string;
	title: string;
	authors: string[];
	blocks: Block[];
	plain: {
		blocks: PlainBlock[];
		terms: Record<string, Term>;
	};
};

