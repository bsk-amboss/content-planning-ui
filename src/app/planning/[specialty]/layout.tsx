import { getBackend, getSpecialty } from '@/lib/data/specialties';
import { RememberSpecialty } from '../_components/remember-specialty';
import { NotConfiguredView, SpecialtyHeader } from '../_components/specialty-header';

export default async function SpecialtyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  const specialty = await getSpecialty(slug);

  if (!specialty) return <NotConfiguredView slug={slug} />;

  const backend = getBackend(specialty);

  return (
    <>
      <RememberSpecialty slug={slug} />
      <SpecialtyHeader specialty={specialty} backend={backend} />
      {children}
    </>
  );
}
