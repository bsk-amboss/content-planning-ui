import { listSpecialties } from '@/lib/data/specialties';
import { DashboardEntryView } from './_components/dashboard-entry-view';

export default async function PlanningIndex() {
  const specialties = await listSpecialties();
  return <DashboardEntryView specialties={specialties} />;
}
