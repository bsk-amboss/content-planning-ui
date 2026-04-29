import { Suspense } from 'react';
import { listSpecialtyPhases } from '@/lib/data/pipeline';
import { listSpecialties } from '@/lib/data/specialties';
import { HomeShell, SpecialtiesJumpToShell } from './planning/_components/home-shell';
import {
  SpecialtiesGridSkeleton,
  SpecialtiesGridView,
} from './planning/_components/specialties-grid';
import { SpecialtyEntry } from './planning/_components/specialty-entry';

export default function Home() {
  return (
    <HomeShell
      specialtiesGrid={
        <Suspense fallback={<SpecialtiesGridSkeleton />}>
          <SpecialtiesGridData />
        </Suspense>
      }
      jumpTo={
        <Suspense fallback={null}>
          <SpecialtiesJumpToData />
        </Suspense>
      }
    />
  );
}

async function SpecialtiesGridData() {
  // listSpecialties + listSpecialtyPhases are independently cached. Awaiting in
  // parallel keeps wall time near max(specialties, phases) instead of summing.
  const [specialties, phases] = await Promise.all([
    listSpecialties(),
    listSpecialtyPhases(),
  ]);
  return <SpecialtiesGridView specialties={specialties} phases={phases} />;
}

async function SpecialtiesJumpToData() {
  const specialties = await listSpecialties();
  if (specialties.length === 0) return null;
  return <SpecialtiesJumpToShell entry={<SpecialtyEntry specialties={specialties} />} />;
}
