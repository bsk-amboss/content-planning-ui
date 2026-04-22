'use client';

import { Inline, Link, Text } from '@amboss/design-system';
import NextLink from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <Inline space="xs" vAlignItems="center">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        const key = `${c.href ?? ''}::${c.label}`;
        return (
          <Inline key={key} space="xs" vAlignItems="center">
            {c.href && !isLast ? (
              <NextLink href={c.href} style={{ textDecoration: 'none' }}>
                <Link as="span" color="tertiary">
                  {c.label}
                </Link>
              </NextLink>
            ) : (
              <Text color={isLast ? 'primary' : 'secondary'}>{c.label}</Text>
            )}
            {!isLast && <Text color="tertiary">/</Text>}
          </Inline>
        );
      })}
    </Inline>
  );
}
