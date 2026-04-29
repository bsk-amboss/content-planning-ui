import { Suspense } from 'react';
import {
  listArticleUpdateSuggestions,
  listConsolidatedArticles,
  listNewArticleSuggestions,
} from '@/lib/data/articles';
import { ArticlesView } from '../../_components/articles-view';
import { TableSkeleton } from '../../_components/table-skeleton';

export default async function ArticlesPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  return (
    <Suspense fallback={<TableSkeleton columns={6} rows={10} />}>
      <ArticlesData slug={slug} />
    </Suspense>
  );
}

async function ArticlesData({ slug }: { slug: string }) {
  const [consolidated, newOnes, updates] = await Promise.all([
    listConsolidatedArticles(slug),
    listNewArticleSuggestions(slug),
    listArticleUpdateSuggestions(slug),
  ]);
  return <ArticlesView consolidated={consolidated} newOnes={newOnes} updates={updates} />;
}
