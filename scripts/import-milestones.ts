/**
 * Write milestone text from a local file into specialties.milestones in Convex.
 *
 * Usage:
 *   pnpm db:import-milestones -- anesthesiology anesthesiology_milestones.txt
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { env } from '@/env';
import { api } from '../convex/_generated/api';

async function main() {
  const [slug, file] = process.argv.slice(2);
  if (!slug || !file) {
    console.error('Usage: db:import-milestones -- <slug> <file>');
    process.exit(1);
  }
  if (!env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
  }
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const text = (await readFile(abs, 'utf8')).trim();

  const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
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
