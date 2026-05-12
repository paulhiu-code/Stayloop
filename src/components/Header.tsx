import { Home, Menu, X, User, LogOut, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Header({
  onShowAuth,
  onShowDashboard,
}: {
  onShowAuth: () => void;
  onShowDashboard: () => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile, signOut } = useAuth();

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-lg">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <a href="/" className="flex items-center gap-3 cursor-pointer group">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 via-rose-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105">
              <Home className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-gray-900 tracking-tight">StayLoop</div>
              <div className="text-xs text-gray-500 font-medium">Book Your Next Stay</div>
            </div>
          </a>

          <div className="hidden md:flex items-center gap-8">
            <a href="#" className="text-gray-700 hover:text-orange-600 font-semibold transition-colors duration-200 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-orange-600 after:transition-all after:duration-300">
              Explore
            </a>
            <a href="/hosts" className="text-gray-700 hover:text-orange-600 font-semibold transition-colors duration-200 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-orange-600 after:transition-all after:duration-300">
              Become a Host
            </a>

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
              <button
                onClick={onShowAuth}
                className="px-7 py-3.5 bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 text-white font-bold rounded-xl hover:shadow-xl transition-all duration-300 shadow-lg transform hover:scale-105"
              >
                Sign In
              </button>
            )}
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-700"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col gap-4">
              <a href="#" className="text-gray-700 hover:text-orange-600 font-medium transition">
                Explore
              </a>
              <a href="/hosts" className="text-gray-700 hover:text-orange-600 font-medium transition">
                Become a Host
              </a>
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
                <button
                  onClick={onShowAuth}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-rose-600 transition-all shadow-md"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
