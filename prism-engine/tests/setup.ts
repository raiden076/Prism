import { readD1Migrations } from '@cloudflare/vitest-pool-workers';
import type { D1Database } from '@cloudflare/workers-types';

let migrations: any[] | undefined;

export async function applyMigrations(db: D1Database): Promise<void> {
  if (!migrations) {
    migrations = await readD1Migrations('./migrations');
  }
  const { applyD1Migrations } = await import('cloudflare:test');
  await applyD1Migrations(db, migrations);
}
