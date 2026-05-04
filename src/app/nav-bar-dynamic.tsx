'use client';

import {
  Box,
  DropdownMenu,
  Inline,
  Logo,
  NavBar,
  NavBarName,
} from '@amboss/design-system';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';

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

function UserMenu() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : 'skip');
  const { signOut } = useAuthActions();
  const router = useRouter();

  if (!isAuthenticated || !user?.email) return null;

  const localPart = user.email.split('@')[0] ?? user.email;

  return (
    <DropdownMenu
      label={localPart}
      iconName="user"
      triggerAriaLabel={`Open user menu for ${localPart}`}
      menuItems={[
        { label: 'Settings', onSelect: () => router.push('/settings') },
        'separator',
        {
          label: 'Sign out',
          onSelect: async () => {
            await signOut();
            // Hard navigation — same reason as the post-sign-in case in
            // src/app/login/page.tsx: guarantees the proxy reads the cleared
            // cookie on the next request and avoids any stale-state flicker.
            window.location.assign('/login');
          },
        },
      ]}
    />
  );
}

export function NavBarDynamic() {
  const pathname = usePathname() ?? '/';
  const isCompact = useScrollCompact();
  const { isAuthenticated } = useConvexAuth();
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
        <div
          className={
            isAuthenticated
              ? 'primary-nav-content'
              : 'primary-nav-content primary-nav-content--solo'
          }
        >
          <Inline space="m" vAlignItems="center">
            <Logo href="/" ariaLabel="AMBOSS Content Planner — Home" />
            {isAuthenticated && (
              <NavBar.PrimaryNav aria-label="Main navigation">
                <NavBar.PrimaryNavItem label="Content Planner" href="/" isActive />
              </NavBar.PrimaryNav>
            )}
          </Inline>
          <div className="primary-nav-user">
            <UserMenu />
          </div>
        </div>
      </NavBar.PrimaryNavContainer>
      {isAuthenticated && (
        <NavBar.SubMenuContainer>
          <Box space="m" vSpace="zero">
            <NavBar.SecondaryNav
              aria-label="Secondary navigation"
              items={NAV_ITEMS}
              activeIndex={activeIndex}
            />
          </Box>
        </NavBar.SubMenuContainer>
      )}
    </NavBar>
  );
}
