'use client';

import { Box, Inline, Logo, NavBar, NavBarName } from '@amboss/design-system';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Specialty Dashboard', href: '/planning' },
];

function useScrollCompact() {
  const [isCompact, setIsCompact] = useState(false);
  const previousScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const previousY = previousScrollY.current;
      if (currentY > previousY && currentY > 0) setIsCompact(true);
      else if (currentY < previousY) setIsCompact(false);
      previousScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return isCompact;
}

export function NavBarDynamic() {
  const pathname = usePathname() ?? '/';
  const isCompact = useScrollCompact();
  const activeIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) =>
      item.href === '/'
        ? pathname === '/'
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    ),
  );

  return (
    <NavBar subTheme={NavBarName.Learning} isCompact={isCompact}>
      <NavBar.PrimaryNavContainer>
        <div className="primary-nav-content">
          <Inline space="m" vAlignItems="center">
            <Logo href="/" ariaLabel="AMBOSS Content Planner — Home" />
            <NavBar.PrimaryNav aria-label="Main navigation">
              <NavBar.PrimaryNavItem label="Content Planner" href="/" isActive />
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
  );
}
