'use client';

import { useEffect } from 'react';

export function RememberSpecialty({ slug }: { slug: string }) {
  useEffect(() => {
    window.localStorage.setItem('lastSpecialty', slug);
  }, [slug]);
  return null;
}
