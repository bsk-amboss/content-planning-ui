/**
 * Write milestone text from a local file into specialties.milestones in Convex.
 *
 * Usage:
 *   pnpm db:import-milestones -- anesthesiology anesthesiology_milestones.txt
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { api } from '../convex/_generated/api';
import { convexClient } from './_lib/convex';

async function main() {
  const [slug, file] = process.argv.slice(2);
  if (!slug || !file) {
    console.error('Usage: db:import-milestones -- <slug> <file>');
    process.exit(1);
  }
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const text = (await readFile(abs, 'utf8')).trim();

  const convex = convexClient();
  await convex.mutation(api.specialties.updateMilestones, {
    slug,
    milestones: text,
    bumpSeedTimestamp: true,
  });

  console.log(
    `✓ Wrote ${text.length.toLocaleString()} chars of milestones to '${slug}'.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
