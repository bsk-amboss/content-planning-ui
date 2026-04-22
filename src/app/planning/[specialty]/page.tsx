import { listConsolidatedArticles, listNewArticleSuggestions } from '@/lib/data/articles';
import { listCategories } from '@/lib/data/categories';
import { listCodes } from '@/lib/data/codes';
import { listConsolidatedSections } from '@/lib/data/sections';
import { getSpecialty } from '@/lib/data/specialties';
import { getStats } from '@/lib/data/stats';
import { OverviewView } from '../_components/overview-view';

export default async function SpecialtyOverview({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  const specialty = await getSpecialty(slug);
  if (!specialty) return null;

  const [codes, categories, articles, newArticles, sections, stats] = await Promise.all([
    listCodes(slug),
    listCategories(slug),
    listConsolidatedArticles(slug),
    listNewArticleSuggestions(slug),
    listConsolidatedSections(slug),
    getStats(slug),
  ]);

  const mappedCodes = codes.filter((c) => c.coverageLevel !== undefined).length;

  const statItems = [
    { label: 'Codes', value: codes.length, hint: `${mappedCodes} mapped` },
    { label: 'Categories', value: categories.length },
    {
      label: 'Consolidated articles',
      value: articles.length,
      hint: `${newArticles.length} new suggestions`,
    },
    { label: 'Consolidated sections', value: sections.length },
  ];

  const note =
    stats.totalCodes !== undefined
      ? `Stats tab: total ${stats.totalCodes} · completed mappings ${stats.completedMappings ?? 0}.`
      : undefined;

  return <OverviewView stats={statItems} note={note} />;
}
