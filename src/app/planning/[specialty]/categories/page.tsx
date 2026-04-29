import { Suspense } from 'react';
import { listCategories } from '@/lib/data/categories';
import { CategoriesView } from '../../_components/categories-view';
import { TableSkeleton } from '../../_components/table-skeleton';

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  return (
    <Suspense fallback={<TableSkeleton columns={5} rows={10} />}>
      <CategoriesData slug={slug} />
    </Suspense>
  );
}

async function CategoriesData({ slug }: { slug: string }) {
  const rows = await listCategories(slug);
  return <CategoriesView rows={rows} slug={slug} />;
}
