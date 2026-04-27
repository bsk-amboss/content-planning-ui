/**
 * Write milestone text from a local file into specialties.milestones.
 *
 * Usage:
 *   npm run db:import-milestones -- anesthesiology anesthesiology_milestones.txt
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { specialties } from '@/lib/db/schema';

async function main() {
  const [slug, file] = process.argv.slice(2);
  if (!slug || !file) {
    console.error('Usage: db:import-milestones -- <slug> <file>');
    process.exit(1);
  }
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const text = (await readFile(abs, 'utf8')).trim();

  const db = getDb();
  const result = await db
    .update(specialties)
    .set({ milestones: text })
    .where(eq(specialties.slug, slug))
    .returning({ slug: specialties.slug });

  if (result.length === 0) {
    console.error(`No specialty found with slug '${slug}'.`);
    process.exit(1);
  }
  console.log(`✓ Wrote ${text.length.toLocaleString()} chars of milestones to '${slug}'.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
