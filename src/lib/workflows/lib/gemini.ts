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

export async function extractCodesFromPdfs(input: {
  specialtySlug: string;
  pdfUrls: string[];
}): Promise<RawExtractedCode[]> {
  'use step';
  console.log('[pipeline] extractCodesFromPdfs', {
    specialtySlug: input.specialtySlug,
    pdfCount: input.pdfUrls.length,
    stubbed: !hasGeminiCreds(),
  });
  if (!hasGeminiCreds()) {
    return [
      {
        code: 'STUB.001',
        category: 'Airway Management',
        description: 'Stubbed extracted code 1',
        source: 'stub',
      },
      {
        code: 'STUB.002',
        category: 'Airway Management',
        description: 'Stubbed extracted code 2',
        source: 'stub',
      },
      {
        code: 'STUB.003',
        category: 'Cardiovascular',
        description: 'Stubbed extracted code 3',
        source: 'stub',
      },
    ];
  }
  throw new Error(
    'Real Gemini code extraction not yet wired. Pass the n8n extract-codes workflow to flesh this out.',
  );
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
