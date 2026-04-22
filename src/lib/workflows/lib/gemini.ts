/**
 * Gemini-backed extraction steps (preprocessing stage).
 *
 * Stubbed when `GOOGLE_GENERATIVE_AI_API_KEY` is absent so the durability
 * plumbing can be exercised end-to-end without a live API key. The real
 * `generateObject` wiring lands when the n8n preprocessing workflows are
 * handed over.
 */

import { z } from 'zod';
import { env } from '@/env';

export const ExtractedCodeSchema = z.object({
  code: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
  metadata: z.unknown().optional(),
});

export type RawExtractedCode = z.infer<typeof ExtractedCodeSchema>;

export const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
});

export type Milestone = z.infer<typeof MilestoneSchema>;

export type MilestoneDraft = {
  version: number;
  milestones: Milestone[];
};

export function hasGeminiCreds(): boolean {
  return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY);
}

/**
 * Phase 1 of the two-phase code extraction: identify module/chapter headings
 * for a single PDF. Matches `content_outline_extractor_subworkflow.json` step 1
 * in n8n. Returns one item per discovered module.
 */
export async function identifyModulesForUrl(input: {
  url: string;
  systemPrompt: string;
  specialtySlug: string;
}): Promise<{ category: string }[]> {
  'use step';
  console.log('[pipeline] identifyModulesForUrl', {
    specialtySlug: input.specialtySlug,
    url: input.url,
    stubbed: !hasGeminiCreds(),
  });
  if (!hasGeminiCreds()) {
    return [{ category: 'Stubbed Module A' }, { category: 'Stubbed Module B' }];
  }
  throw new Error(
    'Real Gemini identifyModulesForUrl not yet wired — embed the n8n prompt + AI SDK generateObject call here.',
  );
}

/**
 * Phase 2: extract discrete medical items for one (url, category) pair.
 * Matches `content_outline_category_extractor_subworkflow.json` in n8n.
 * Returns `[{ category: hierarchical-pipe-separated-path, description }]`.
 */
export async function extractCodesForCategory(input: {
  url: string;
  category: string;
  specialtySlug: string;
  systemPrompt: string;
}): Promise<{ category: string; description: string }[]> {
  'use step';
  console.log('[pipeline] extractCodesForCategory', {
    specialtySlug: input.specialtySlug,
    url: input.url,
    category: input.category,
    stubbed: !hasGeminiCreds(),
  });
  if (!hasGeminiCreds()) {
    return [
      { category: `${input.category} | Sub A`, description: 'Stubbed item 1' },
      { category: `${input.category} | Sub B`, description: 'Stubbed item 2' },
    ];
  }
  throw new Error(
    'Real Gemini extractCodesForCategory not yet wired — embed the n8n prompt + AI SDK generateObject call here.',
  );
}

/**
 * @deprecated Superseded by the two-phase `identifyModulesForUrl` +
 * `extractCodesForCategory` flow. Kept for any callers that still import it;
 * remove once nothing references it.
 */
export async function extractCodesFromPdfs(input: {
  specialtySlug: string;
  pdfUrls: string[];
}): Promise<RawExtractedCode[]> {
  'use step';
  console.log('[pipeline] extractCodesFromPdfs (deprecated)', {
    specialtySlug: input.specialtySlug,
    pdfCount: input.pdfUrls.length,
  });
  if (!hasGeminiCreds()) {
    return [
      {
        code: 'STUB.001',
        category: 'Airway Management',
        description: 'Stubbed extracted code 1',
        source: 'stub',
      },
    ];
  }
  throw new Error('extractCodesFromPdfs is deprecated — use the two-phase flow.');
}

export async function extractMilestonesFromPdfs(input: {
  specialtySlug: string;
  pdfUrls: string[];
}): Promise<MilestoneDraft> {
  'use step';
  console.log('[pipeline] extractMilestonesFromPdfs', {
    specialtySlug: input.specialtySlug,
    pdfCount: input.pdfUrls.length,
    stubbed: !hasGeminiCreds(),
  });
  if (!hasGeminiCreds()) {
    return {
      version: 1,
      milestones: [
        { id: 'M1', title: 'Stubbed milestone 1', description: 'Placeholder' },
        { id: 'M2', title: 'Stubbed milestone 2', description: 'Placeholder' },
      ],
    };
  }
  throw new Error(
    'Real Gemini milestone extraction not yet wired. Pass the n8n extract-milestones workflow to flesh this out.',
  );
}
