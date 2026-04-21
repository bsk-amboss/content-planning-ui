'use client';

import {
  Box,
  Divider,
  Inline,
  Link,
  Logo,
  NavBar,
  NavBarName,
  Stack,
  Text,
} from '@amboss/design-system';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const NAV_ITEMS = [
  { label: 'Overview', href: '/' },
  { label: 'Components', href: '/components' },
  { label: 'Demo', href: '/demo' },
];

function useScrollCompact() {
  const [isCompact, setIsCompact] = useState(false);
  const previousScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const previousY = previousScrollY.current;

      if (currentY > previousY && currentY > 0) {
        setIsCompact(true);
      } else if (currentY < previousY) {
        setIsCompact(false);
      }

      previousScrollY.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return isCompact;
}

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCompact = useScrollCompact();
  const activeIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.href === pathname),
  );

  return (
    <>
      <div className="nav-fixed">
        <NavBar subTheme={NavBarName.Learning} isCompact={isCompact}>
          <NavBar.PrimaryNavContainer>
            <div className="primary-nav-content">
              <Inline space="l" vAlignItems="center">
                <Logo href="/" ariaLabel="amboss-content-planner-ui — Home" />
                <NavBar.PrimaryNav aria-label="Main navigation">
                  <NavBar.PrimaryNavItem label="Home" href="/" isActive />
                </NavBar.PrimaryNav>
              </Inline>
            </div>
          </NavBar.PrimaryNavContainer>
          <NavBar.SubMenuContainer>
            <Box space="m" vSpace="zero">
              <NavBar.SecondaryNav
                aria-label="Secondary navigation"
                items={NAV_ITEMS}
                activeIndex={activeIndex}
              />
            </Box>
          </NavBar.SubMenuContainer>
        </NavBar>
      </div>

      <main className="content">
        <Box space={['m', 'l', 'xxl']} vSpace="xl">
          <div style={{ maxWidth: 1040, margin: '0 auto' }}>
            <Stack space="xxl">
              {children}

              <Divider />

              <Inline space="s" alignItems="center" vAlignItems="center">
                <Text color="secondary">
                  Scaffolded with <strong>create-amboss-app</strong>
                </Text>
                <Text color="secondary">&middot;</Text>
                <Link href="https://design-system.miamed.de/" color="tertiary">
                  DS Docs
                </Link>
                <Text color="secondary">&middot;</Text>
                <Link href="https://nextjs.org/docs" color="tertiary">
                  Next.js Docs
                </Link>
              </Inline>
            </Stack>
          </div>
        </Box>
      </main>
    </>
  );
}
