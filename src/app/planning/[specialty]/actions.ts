'use server';

import { updateTag } from 'next/cache';

export async function refreshSpecialty(slug: string) {
  updateTag(`specialty:${slug}`);
}
