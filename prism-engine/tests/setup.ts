/**
 * Test setup helper - applies all D1 migrations from the migrations directory.
 *
 * Reads each .sql file in order and executes against the test D1 database.
 * Used by route-level integration tests that need real schema.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export async function applyMigrations(db: D1Database): Promise<void> {
  const migrationsDir = join(import.meta.dirname, '..', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    const statements = sql
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    for (const stmt of statements) {
      await db.exec(stmt);
    }
  }
}
