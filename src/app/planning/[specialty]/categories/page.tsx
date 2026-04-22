import { listCategories } from '@/lib/data/categories';
import { CategoriesView } from '../../_components/categories-view';

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  const rows = await listCategories(slug);
  return <CategoriesView rows={rows} slug={slug} />;
}
