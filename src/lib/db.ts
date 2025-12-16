import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { DATABASE_URL } from '$env/static/private';
import type { Paper } from './types';

export const papers = pgTable('papers', {
	id: text('id').primaryKey(),
	sourceUrl: text('source_url').notNull(),
	data: jsonb('data').$type<Paper>().notNull(),
	createdAt: timestamp('created_at').defaultNow()
});

export const db = drizzle(DATABASE_URL);
