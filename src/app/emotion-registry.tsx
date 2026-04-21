'use client';

import { CacheProvider, createCache, light, ThemeProvider } from '@amboss/design-system';
import type { EmotionCache } from '@emotion/cache';
import { useServerInsertedHTML } from 'next/navigation';
import { type ReactNode, useState } from 'react';

export function EmotionRegistry({ children }: { children: ReactNode }) {
  const [registry] = useState(() => {
    const cache: EmotionCache = createCache({ key: 'amboss' });
    cache.compat = true;
    const prevInsert = cache.insert;
    let inserted: string[] = [];
    cache.insert = (...args) => {
      const serialized = args[1];
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const flush = () => {
      const prev = inserted;
      inserted = [];
      return prev;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = registry.flush();
    if (names.length === 0) return null;
    let styles = '';
    for (const name of names) {
      styles += registry.cache.inserted[name];
    }
    return (
      <style
        key={registry.cache.key}
        data-emotion={`${registry.cache.key} ${names.join(' ')}`}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Emotion SSR style injection
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={registry.cache}>
      <ThemeProvider theme={light}>{children}</ThemeProvider>
    </CacheProvider>
  );
}
