import { redirect } from 'next/navigation';

export default async function SourcesIndex({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty } = await params;
  redirect(`/planning/${specialty}/sources/ICD10`);
}
