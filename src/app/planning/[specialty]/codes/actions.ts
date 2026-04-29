'use server';

import {
  getConsolidationLockState,
  listCodes,
  listInFlightMappings,
} from '@/lib/data/codes';

export interface CodesQueryData {
  codes: Awaited<ReturnType<typeof listCodes>>;
  lock: Awaited<ReturnType<typeof getConsolidationLockState>>;
  inFlight: string[];
}

export async function fetchCodesData(slug: string): Promise<CodesQueryData> {
  const [codes, lock, inFlight] = await Promise.all([
    listCodes(slug),
    getConsolidationLockState(slug),
    listInFlightMappings(slug),
  ]);
  return { codes, lock, inFlight };
}
