import { listSpecialties } from '@/lib/data/specialties';
import { HomeView } from './planning/_components/home-view';

export default async function Home() {
  const specialties = await listSpecialties();
  return <HomeView specialties={specialties} />;
}
