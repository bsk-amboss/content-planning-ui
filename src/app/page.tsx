import { Suspense } from 'react';
import { listSpecialtyPhases } from '@/lib/data/pipeline';
import { listSpecialties } from '@/lib/data/specialties';
import { HomeView } from './planning/_components/home-view';

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeData />
    </Suspense>
  );
}

async function HomeData() {
  const [specialties, phases] = await Promise.all([
    listSpecialties(),
    listSpecialtyPhases(),
  ]);
  return <HomeView specialties={specialties} phases={phases} />;
}
