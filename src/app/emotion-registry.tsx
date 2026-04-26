'use client';

import { CacheProvider, createCache, light, ThemeProvider } from '@amboss/design-system';
import type { EmotionCache } from '@emotion/cache';
import { useServerInsertedHTML } from 'next/navigation';
import { type ReactNode, useState } from 'react';

// The DS ships `theme.variables.zIndex.dropdown = 1`, the same z-index that
// our sticky table headers (z=1) use. Without overriding, Combobox/Select
// menus that portal to body land at the same z as the sticky thead — which
// in DOM order means they sit above table cells but visually conflict with
// the headers. Bumping the dropdown layer to 100 keeps the menu cleanly
// above any sticky surface in the app.
const theme = {
  ...light,
  variables: {
    ...light.variables,
    zIndex: {
      ...light.variables.zIndex,
      dropdown: 100,
    },
  },
};

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
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </CacheProvider>
  );
}
