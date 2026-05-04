import { connection } from 'next/server';
import { fetchQueryAsUser } from '@/lib/convex/server';
import type {
  ArticleUpdateSuggestion,
  ConsolidatedArticle,
  NewArticleSuggestion,
} from '@/lib/types';
import { api } from '../../../convex/_generated/api';

// Strip Convex's `_id` / `_creationTime` / `specialtySlug` so the type
// matches the legacy repository shape consumers expect.
function strip<T>(rows: Array<Record<string, unknown>>): T[] {
  return rows.map((row) => {
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
