/**
 * AMBOSS MCP-backed mapping steps.
 *
 * Stubbed when mapping credentials are missing so the pipeline can progress
 * through the mapping stage with canned output. Real implementation wires a
 * DurableAgent against the AMBOSS content MCP server once the n8n mapping
 * workflow is handed over.
 */

import { env } from '@/env';

export type MappingResult = {
  code: string;
  isInAmboss: boolean;
  coverageLevel: string | null;
  newArticlesNeeded: unknown[];
  existingArticleUpdates: unknown[];
  raw?: unknown;
};

export function hasMappingCreds(): boolean {
  return Boolean(
    env.AMBOSS_MCP_URL && env.AMBOSS_MCP_TOKEN && env.GOOGLE_GENERATIVE_AI_API_KEY,
  );
}

export async function mapOneCode(input: {
  code: string;
  category?: string | null;
  description?: string | null;
}): Promise<MappingResult> {
  'use step';
  console.log('[pipeline] mapOneCode', {
    code: input.code,
    stubbed: !hasMappingCreds(),
  });
  if (!hasMappingCreds()) {
    return {
      code: input.code,
      isInAmboss: false,
      coverageLevel: 'not-covered',
      newArticlesNeeded: [],
      existingArticleUpdates: [],
    };
  }
  throw new Error(
    'Real AMBOSS MCP mapping not yet wired. Pass the n8n mapping workflow to flesh this out.',
  );
}
