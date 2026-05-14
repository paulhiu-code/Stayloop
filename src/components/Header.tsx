import { LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { AuthMode } from './AuthModal';
import StayLoopLogo from './StayLoopLogo';

export type SitePage = 'home' | 'hosts' | 'partners';

export default function Header({
  onShowAuth,
  onShowDashboard,
  onNavigate,
  showHostLinks = false,
  showPartnerProgram = false,
}: {
  onShowAuth: (mode?: AuthMode) => void;
  onShowDashboard: () => void;
  onNavigate?: (page: SitePage) => void;
  showHostLinks?: boolean;
  showPartnerProgram?: boolean;
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
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-900/5 backdrop-blur-xl">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <button onClick={() => goTo('home')} className="group flex cursor-pointer items-center text-left">
            <StayLoopLogo className="w-36 transition-transform duration-300 group-hover:scale-[1.02]" showTagline />
          </button>

          <div className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => goTo(item.page)}
                className="relative text-[0.95rem] font-semibold text-slate-700 transition-colors duration-200 hover:text-orange-600 after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-orange-600 after:transition-all after:duration-300 hover:after:w-full"
              >
                {item.label}
              </button>
            ))}

            {user ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={onShowDashboard}
                  className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:text-orange-600 font-semibold transition-colors duration-200 rounded-lg hover:bg-orange-50"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Dashboard
                </button>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {profile?.full_name || 'User'}
                    </div>
                    <div className="text-xs text-gray-500">{profile?.referral_code}</div>
                  </div>
                  <div className="w-11 h-11 bg-gradient-to-br from-orange-500 via-rose-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2 border-white">
                    {profile?.full_name?.[0] || <User className="w-5 h-5" />}
                  </div>
                </div>
                <button
                  onClick={signOut}
                  className="p-2 text-gray-500 hover:text-rose-600 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onShowAuth('signin')}
                  className="rounded-full px-4 py-2.5 text-[0.95rem] font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-100 hover:text-slate-950"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onShowAuth('signup')}
                  className="rounded-full bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 px-6 py-3 text-[0.95rem] font-extrabold text-white shadow-lg shadow-orange-500/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/25"
                >
                  Join StayLoop
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-full p-2 text-slate-700 transition hover:bg-slate-100 md:hidden"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-100 py-4 md:hidden">
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => goTo(item.page)}
                  className="text-left font-semibold text-slate-700 transition hover:text-orange-600"
                >
                  {item.label}
                </button>
              ))}
              {user ? (
                <>
                  <button
                    onClick={onShowDashboard}
                    className="text-left text-gray-700 hover:text-orange-600 font-medium transition"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={signOut}
                    className="text-left text-gray-700 hover:text-rose-600 font-medium transition"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => onShowAuth('signin')}
                    className="rounded-2xl border border-slate-200 px-6 py-3 font-bold text-slate-700 transition-all hover:bg-slate-50"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => onShowAuth('signup')}
                    className="rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-3 font-bold text-white shadow-md transition-all hover:from-orange-600 hover:to-rose-600"
                  >
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
