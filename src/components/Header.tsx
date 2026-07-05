import { LayoutDashboard, LogOut, Menu, Plane, User, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { AuthMode } from './AuthModal';

export type SitePage = 'home' | 'search' | 'hosts' | 'partners' | 'host-onboarding' | 'host-dashboard' | 'checkout' | 'property';

export default function Header({
  onShowAuth,
  onShowDashboard,
  onShowAdmin,
  onNavigate,
  showHostLinks = false,
  showPartnerProgram = false,
  showAdminLink = false,
}: {
  onShowAuth: (mode?: AuthMode) => void;
  onShowDashboard: () => void;
  onShowAdmin?: () => void;
  onNavigate?: (page: SitePage) => void;
  showHostLinks?: boolean;
  showPartnerProgram?: boolean;
  showAdminLink?: boolean;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile, signOut } = useAuth();

  function goTo(page: SitePage) {
    onNavigate?.(page);
    setMobileMenuOpen(false);
  }

  const navItems = [
    { label: 'Explore', page: 'home' as const },
    ...(showHostLinks ? [{ label: 'List your place', page: 'hosts' as const }] : []),
    ...(showPartnerProgram ? [{ label: 'Partner program', page: 'partners' as const }] : []),
  ];

  return (
    <header className="header-shell">
      <nav className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <button onClick={() => goTo('home')} className="group flex cursor-pointer items-center gap-3 text-left">
            <div className="logo-mark group-hover:opacity-90">
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <div className="logo-wordmark">StayLoop</div>
              <div className="logo-tagline">Find stays that fit your trip</div>
            </div>
          </button>

          <div className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <button key={item.label} onClick={() => goTo(item.page)} className="nav-link">
                {item.label}
              </button>
            ))}

            {user ? (
              <div className="flex items-center gap-4">
                {showAdminLink && onShowAdmin && (
                  <button onClick={onShowAdmin} className="btn-secondary !rounded-pill !px-4 !py-2.5 !text-sm">
                    Admin
                  </button>
                )}
                <button onClick={onShowDashboard} className="btn-ghost">
                  <LayoutDashboard className="h-5 w-5" />
                  Dashboard
                </button>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-ink">{profile?.full_name || 'User'}</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface bg-brand text-sm font-bold text-brand-foreground shadow-card">
                    {profile?.full_name?.[0] || <User className="h-5 w-5" />}
                  </div>
                </div>
                <button onClick={signOut} className="btn-ghost !p-2 text-ink-subtle hover:text-brand" title="Sign Out">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => onShowAuth('signin')} className="btn-ghost">
                  Sign In
                </button>
                <button onClick={() => onShowAuth('signup')} className="btn-primary">
                  Join StayLoop
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-full p-2 text-ink transition hover:bg-page-muted md:hidden"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border py-4 md:hidden">
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <button key={item.label} onClick={() => goTo(item.page)} className="nav-link text-left">
                  {item.label}
                </button>
              ))}
              {user ? (
                <>
                  {showAdminLink && onShowAdmin && (
                    <button
                      onClick={() => {
                        onShowAdmin();
                        setMobileMenuOpen(false);
                      }}
                      className="text-left text-sm font-semibold text-brand"
                    >
                      Admin
                    </button>
                  )}
                  <button onClick={onShowDashboard} className="btn-ghost !justify-start">
                    Dashboard
                  </button>
                  <button onClick={signOut} className="btn-ghost !justify-start">
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <button onClick={() => onShowAuth('signin')} className="btn-secondary">
                    Sign In
                  </button>
                  <button onClick={() => onShowAuth('signup')} className="btn-primary">
                    Join StayLoop
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
