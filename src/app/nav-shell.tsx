import { Suspense } from 'react';
import { NavBarDynamic } from './nav-bar-dynamic';
import { NavShellFooter } from './nav-shell-footer';

export function NavShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="nav-fixed">
        <Suspense fallback={<div className="nav-placeholder" />}>
          <NavBarDynamic />
        </Suspense>
      </div>

      <main className="content">
        <div className="content-inner">
          <NavShellFooter>{children}</NavShellFooter>
        </div>
      </main>
    </>
  );
}
