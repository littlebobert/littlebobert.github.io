import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationPath = fileURLToPath(new URL('../migrations/0001_initial.sql', import.meta.url));

function statementAdapter(database, sql, bindings = []) {
  return {
    bind(...values) {
      return statementAdapter(database, sql, values);
    },
    async all() {
      return { results: database.prepare(sql).all(...bindings) };
    },
    async first() {
      return database.prepare(sql).get(...bindings) || null;
    },
    async run() {
      const result = database.prepare(sql).run(...bindings);
      return {
        meta: {
          changes: Number(result.changes),
          last_row_id: Number(result.lastInsertRowid),
        },
      };
    },
  };
}

export function createTestDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(migrationPath, 'utf8'));
  return {
    database,
    d1: {
      prepare(sql) {
        return statementAdapter(database, sql);
      },
    },
  };
}
