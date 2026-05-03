import { connection } from 'next/server';
import { fetchQueryAsUser } from '@/lib/convex/server';
import { hydrateCodesBlobs } from '@/lib/convex-blobs';
import type {
  ArticleUpdateSuggestion,
  ConsolidatedArticle,
  NewArticleSuggestion,
} from '@/lib/repositories/types';
import { api } from '../../../convex/_generated/api';

// Articles live in Convex. The `codes` blob is JSON-stringified on the wire
// (see `convex-blobs.ts`); we parse it here and strip Convex's `_id` /
// `_creationTime` / `specialtySlug` so the type matches the existing
// repository shape consumers expect.
function strip<T>(rows: Array<Record<string, unknown>>): T[] {
  return hydrateCodesBlobs(rows).map((row) => {
    const { _id: _i, _creationTime: _ct, specialtySlug: _s, ...rest } = row;
    return rest as T;
  });
}

export async function listConsolidatedArticles(
  slug: string,
): Promise<ConsolidatedArticle[]> {
  await connection();
  return strip(await fetchQueryAsUser(api.articles.listConsolidated, { slug }));
}

export async function listNewArticleSuggestions(
  slug: string,
): Promise<NewArticleSuggestion[]> {
  await connection();
  return strip(await fetchQueryAsUser(api.articles.listNew, { slug }));
}

export async function listArticleUpdateSuggestions(
  slug: string,
): Promise<ArticleUpdateSuggestion[]> {
  await connection();
  return strip(await fetchQueryAsUser(api.articles.listUpdates, { slug }));
}
