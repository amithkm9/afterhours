import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const records = sqliteTable('records', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  owner: text('owner').notNull(),
  value: text('value').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [index('records_owner_kind').on(table.owner, table.kind)]);
