import {
  listArticleUpdateSuggestions,
  listConsolidatedArticles,
  listNewArticleSuggestions,
} from '@/lib/data/articles';
import { ArticlesView } from '../../_components/articles-view';

export default async function ArticlesPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  const [consolidated, newOnes, updates] = await Promise.all([
    listConsolidatedArticles(slug),
    listNewArticleSuggestions(slug),
    listArticleUpdateSuggestions(slug),
  ]);
  return <ArticlesView consolidated={consolidated} newOnes={newOnes} updates={updates} />;
}
