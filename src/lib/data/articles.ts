import { cacheLife, cacheTag } from 'next/cache';
import { getRepositories } from '@/lib/repositories';

export async function listConsolidatedArticles(slug: string) {
  'use cache';
  cacheTag(`specialty:${slug}`, `articles:${slug}`);
  cacheLife('minutes');
  const { repos } = getRepositories();
  return repos.articles.listConsolidated(slug);
}

export async function listNewArticleSuggestions(slug: string) {
  'use cache';
  cacheTag(`specialty:${slug}`, `articles:${slug}`);
  cacheLife('minutes');
  const { repos } = getRepositories();
  return repos.articles.listNew(slug);
}

export async function listArticleUpdateSuggestions(slug: string) {
  'use cache';
  cacheTag(`specialty:${slug}`, `articles:${slug}`);
  cacheLife('minutes');
  const { repos } = getRepositories();
  return repos.articles.listUpdates(slug);
}
