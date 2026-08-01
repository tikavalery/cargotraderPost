import AppShell from '../../layout/AppShell';

/** Shared shell wrapper for Stores & Sales sub-pages (sidebar sub-nav handled globally). */
export default function StoresLayout({ children, breadcrumbs, navbarRight, hideSearch = true }) {
  return (
    <AppShell hideSearch={hideSearch} breadcrumbs={breadcrumbs} navbarRight={navbarRight}>
      {children}
    </AppShell>
  );
}
