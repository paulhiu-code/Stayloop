import { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header, { SitePage } from './components/Header';
import Hero from './components/Hero';
import PropertyCard from './components/PropertyCard';
import AuthModal, { AuthMode } from './components/AuthModal';
import Dashboard from './components/Dashboard';
import HostsPage from './components/HostsPage';
import PartnersPage from './components/PartnersPage';
import HostOnboarding from './components/HostOnboarding';
import HostDashboard from './components/HostDashboard';
import CheckoutPage from './components/CheckoutPage';
import AdminDashboard from './components/AdminDashboard';
import ResetPasswordPage from './components/ResetPasswordPage';
import PropertyDetailPage from './components/PropertyDetailPage';
import { supabase, Property } from './lib/supabase';
import { showcaseProperties } from './data/showcase';
import { searchProperties, type SearchFilters } from './lib/search';
import { buildSearchPath, parseSearchParams } from './lib/searchUrl';
import SearchResultsPage from './components/search/SearchResultsPage';

const featuredMarkets = [
  {
    title: 'Lake Tahoe',
    stays: 'Lake cabins and mountain homes',
    image: 'https://images.pexels.com/photos/803975/pexels-photo-803975.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    title: 'Joshua Tree',
    stays: 'Desert retreats and stargazing stays',
    image: 'https://images.pexels.com/photos/273935/pexels-photo-273935.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    title: 'Myrtle Beach',
    stays: 'Condos near sand, golf, and boardwalks',
    image: 'https://images.pexels.com/photos/533923/pexels-photo-533923.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    title: 'Great Smoky Mountains',
    stays: 'Cabins, hot tubs, and scenic porches',
    image: 'https://images.pexels.com/photos/167684/pexels-photo-167684.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    title: 'Hawaii',
    stays: 'Island villas, lanais, and beach walks',
    image: 'https://images.pexels.com/photos/457882/pexels-photo-457882.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    title: 'Nashville',
    stays: 'Music City homes for weekend trips',
    image: 'https://images.pexels.com/photos/164693/pexels-photo-164693.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    title: 'OBX',
    stays: 'Outer Banks beach houses for groups',
    image: 'https://images.pexels.com/photos/1438834/pexels-photo-1438834.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    title: 'Gulf Shores',
    stays: 'Gulf-front condos and family homes',
    image: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    title: 'Destin',
    stays: 'Emerald Coast stays near clear water',
    image: 'https://images.pexels.com/photos/753619/pexels-photo-753619.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
];

function propertyIdFromPath(path: string): string | null {
  const match = path.match(/^\/property\/([^/]+)/);
  return match?.[1] || null;
}

function pageFromPath(path: string): SitePage | 'reset-password' | 'admin' {
  if (path === '/admin') return 'admin';
  if (path === '/reset-password') return 'reset-password';
  if (path === '/search' || path.startsWith('/search/')) return 'search';
  if (path === '/hosts') return 'hosts';
  if (path === '/partners') return 'partners';
  if (path === '/host-onboarding') return 'host-onboarding';
  if (path === '/host-dashboard') return 'host-dashboard';
  if (path === '/checkout') return 'checkout';
  if (propertyIdFromPath(path)) return 'property';
  return 'home';
}

function pathFromPage(
  page: SitePage | 'reset-password' | 'admin',
  propertyId?: string,
  searchQuery?: string
) {
  if (page === 'admin') return '/admin';
  if (page === 'reset-password') return '/reset-password';
  if (page === 'search') {
    return searchQuery ? `/search?${searchQuery}` : '/search';
  }
  if (page === 'hosts') return '/hosts';
  if (page === 'partners') return '/partners';
  if (page === 'host-onboarding') return '/host-onboarding';
  if (page === 'host-dashboard') return '/host-dashboard';
  if (page === 'checkout') {
    return window.location.search ? `/checkout${window.location.search}` : '/checkout';
  }
  if (page === 'property' && propertyId) return `/property/${propertyId}`;
  return '/';
}

function AppContent() {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [showDashboard, setShowDashboard] = useState(false);
  const [page, setPage] = useState<SitePage | 'reset-password' | 'admin'>(() => pageFromPath(window.location.pathname));
  const [searchQuery, setSearchQuery] = useState(() => window.location.search);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [propertyId, setPropertyId] = useState<string | null>(() => propertyIdFromPath(window.location.pathname));
  const marketCarouselRef = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading, isAdmin, profile } = useAuth();

  useEffect(() => {
    const handlePopState = () => {
      setPage(pageFromPath(window.location.pathname));
      setPropertyId(propertyIdFromPath(window.location.pathname));
      setSearchQuery(window.location.search);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (page === 'home') {
      fetchFeaturedProperties();
    }
  }, [page]);

  function goToSearch(filters: SearchFilters) {
    const path = buildSearchPath({ ...filters, page: 1 });
    window.history.pushState({}, '', path);
    setSearchQuery(window.location.search);
    setPage('search');
    setPropertyId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function viewProperty(id: string) {
    navigate('property', { propertyId: id });
  }

  async function fetchFeaturedProperties() {
    setLoading(true);
    try {
      const result = await searchProperties({ page: 1, pageSize: 12, sort: 'recommended' });
      setProperties(result.properties);
    } catch (error) {
      console.error('Error fetching properties:', error);
      try {
        const { data, error: fallbackError } = await supabase
          .from('properties')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(12);
        if (fallbackError) throw fallbackError;
        setProperties(data || []);
      } catch (fallbackErr) {
        console.error('Fallback fetch failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  }

  function navigate(nextPage: SitePage | 'reset-password' | 'admin', options?: { propertyId?: string; path?: string }) {
    const path =
      options?.path ||
      (nextPage === 'admin'
        ? '/admin'
        : nextPage === 'reset-password'
          ? '/reset-password'
          : pathFromPage(nextPage, options?.propertyId));
    window.history.pushState({}, '', path);
    setPage(nextPage);
    if (nextPage === 'property' && options?.propertyId) {
      setPropertyId(options.propertyId);
    } else if (nextPage !== 'property') {
      setPropertyId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToCheckout(path: string) {
    navigate('checkout', { path });
  }

  function openAuth(mode: AuthMode = 'signin') {
    setAuthMode(mode);
    setShowAuth(true);
  }

  function scrollMarkets(direction: 'left' | 'right') {
    const carousel = marketCarouselRef.current;
    const scrollDistance = carousel ? carousel.clientWidth - 48 : 960;

    marketCarouselRef.current?.scrollBy({
      left: direction === 'left' ? -scrollDistance : scrollDistance,
      behavior: 'smooth',
    });
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (page === 'admin') {
    if (!user) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-white">
          <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
            <h1 className="text-2xl font-bold">Sign in required</h1>
            <p className="mt-3 text-slate-300">Sign in with a StayLoop admin account to access this area.</p>
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="mt-6 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white"
            >
              Sign in
            </button>
          </div>
        </div>
      );
    }

    if (!isAdmin) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-white">
          <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
            <h1 className="text-2xl font-bold">Admin access required</h1>
            <p className="mt-3 text-slate-300">This area is limited to StayLoop admin accounts.</p>
            <button
              type="button"
              onClick={() => navigate('home')}
              className="mt-6 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white"
            >
              Back to homepage
            </button>
          </div>
        </div>
      );
    }

    return <AdminDashboard onClose={() => navigate('home')} adminEmail={profile?.email} />;
  }

  if (page === 'reset-password') {
    return <ResetPasswordPage onClose={() => navigate('home')} />;
  }

  if (page === 'hosts') {
    return <HostsPage onClose={() => navigate('home')} onNavigate={navigate} />;
  }

  if (page === 'partners') {
    return <PartnersPage onClose={() => navigate('home')} onNavigate={navigate} onShowAuth={() => openAuth('signup')} />;
  }

  if (page === 'host-onboarding') {
    return <HostOnboarding onClose={() => navigate('home')} />;
  }

  if (page === 'host-dashboard') {
    return <HostDashboard onClose={() => navigate('home')} />;
  }

  if (page === 'checkout') {
    return <CheckoutPage onClose={() => navigate('home')} />;
  }

  if (page === 'search') {
    return (
      <>
        <SearchResultsPage
          key={searchQuery}
          onViewStay={viewProperty}
          onNavigateHome={() => navigate('home')}
          onShowAuth={() => openAuth('signin')}
          initialFilters={parseSearchParams(searchQuery.startsWith('?') ? searchQuery.slice(1) : searchQuery)}
        />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialMode={authMode} />}
      </>
    );
  }

  if (page === 'property' && propertyId) {
    return (
      <PropertyDetailPage
        propertyId={propertyId}
        onClose={() => navigate('home')}
        onCheckout={goToCheckout}
        isAuthenticated={Boolean(user)}
        onRequireAuth={() => openAuth('signin')}
      />
    );
  }

  if (showDashboard) {
    return <Dashboard onClose={() => setShowDashboard(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onShowAuth={openAuth}
        onShowDashboard={() => setShowDashboard(true)}
        onNavigate={navigate}
        onShowAdmin={() => navigate('admin')}
        showAdminLink={isAdmin}
      />

      <Hero onSearch={goToSearch} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.24em] text-orange-600">
              Featured stays
            </p>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-2">
              Curated places guests can book next
            </h2>
            <p className="text-gray-600">
              Entire homes, hotel rooms, cabins, and unique stays with a professional booking flow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => goToSearch({ guests: 1 })}
            className="hidden rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:from-orange-600 hover:to-rose-600 md:inline-flex"
          >
            Search all stays
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-gray-200 rounded-2xl mb-4"></div>
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} onViewStay={viewProperty} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {showcaseProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </main>

      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-600">Featured markets</p>
              <h2 className="mt-4 max-w-2xl text-4xl font-extrabold tracking-tight text-gray-900">
                Explore stays in guest-favorite destinations.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-600">
                From mountain cabins to Gulf Coast beach houses, browse top markets travelers search for again and again.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => scrollMarkets('left')}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-2xl font-bold text-gray-900 shadow-lg transition hover:bg-gray-50"
                aria-label="Scroll markets left"
              >
                ‹
              </button>
              <button
                onClick={() => scrollMarkets('right')}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-2xl font-bold text-gray-900 shadow-lg transition hover:bg-gray-50"
                aria-label="Scroll markets right"
              >
                ›
              </button>
            </div>
          </div>

          <div
            ref={marketCarouselRef}
            className="scrollbar-hide -mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-6"
          >
            {featuredMarkets.map((market) => (
              <button
                key={market.title}
                onClick={() => goToSearch({ where: market.title, guests: 1 })}
                className="group min-w-[260px] snap-start overflow-hidden rounded-[2rem] bg-gray-950 text-left shadow-xl transition hover:-translate-y-1 hover:shadow-2xl sm:min-w-[320px]"
              >
                <div className="relative h-72 overflow-hidden">
                  <img
                    src={market.image}
                    alt={market.title}
                    className="h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"></div>
                  <div className="absolute bottom-0 p-6 text-white">
                    <h3 className="text-2xl font-extrabold">{market.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/85">{market.stays}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-rose-50 to-white py-20">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-orange-200 blur-3xl opacity-50"></div>
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-rose-200 blur-3xl opacity-50"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-600">StayLoop Care</p>
            <h2 className="mt-4 text-4xl font-extrabold text-gray-900">
              Book with the confidence every great trip deserves.
            </h2>
            <p className="mt-5 text-lg leading-8 text-gray-600">
              StayLoop Care brings the practical reassurance guests look for before choosing a place to stay.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {[
              ['Real trip support', 'Get help before, during, and after your stay when questions or travel changes come up.'],
              ['Clear total pricing', 'See nightly rates, cleaning fees, and guest fees before you decide to book.'],
              ['Stay details in one place', 'Keep saved favorites, check-in notes, house rules, and trip updates easy to find.'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-[2rem] border border-orange-100 bg-white/85 p-8 shadow-xl backdrop-blur">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 text-2xl font-extrabold text-white shadow-lg">
                  ✓
                </div>
                <h3 className="text-2xl font-extrabold text-gray-900">{title}</h3>
                <p className="mt-4 leading-7 text-gray-600">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white mt-32 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE4YzAtNi42MjcgNS4zNzMtMTIgMTItMTJzMTIgNS4zNzMgMTIgMTItNS4zNzMgMTItMTIgMTItMTItNS4zNzMtMTItMTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 via-rose-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <span className="text-white font-bold text-2xl">S</span>
                </div>
                <span className="text-3xl font-extrabold">StayLoop</span>
              </div>
              <p className="text-gray-400 mb-8 leading-relaxed text-lg">
                Book unique vacation rentals, homes, and experiences around the world.
                Your perfect stay is just a click away.
              </p>
              <div className="flex gap-3">
                <button className="w-11 h-11 bg-gray-800/50 hover:bg-orange-500 border border-gray-700 hover:border-orange-400 rounded-xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 shadow-lg hover:shadow-orange-500/20">
                  <span className="sr-only">Twitter</span>
                  𝕏
                </button>
                <button className="w-11 h-11 bg-gray-800/50 hover:bg-orange-500 border border-gray-700 hover:border-orange-400 rounded-xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 shadow-lg hover:shadow-orange-500/20">
                  <span className="sr-only">Facebook</span>f
                </button>
                <button className="w-11 h-11 bg-gray-800/50 hover:bg-orange-500 border border-gray-700 hover:border-orange-400 rounded-xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 shadow-lg hover:shadow-orange-500/20">
                  <span className="sr-only">Instagram</span>
                  📷
                </button>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-xl mb-5 text-white">Company</h3>
              <ul className="space-y-3">
                <li>
                  <button onClick={() => navigate('home')} className="text-gray-400 hover:text-orange-400 transition-colors duration-200">
                    About StayLoop
                  </button>
                </li>
                <li>
                  <button onClick={() => goToSearch({ guests: 1 })} className="text-gray-400 hover:text-orange-400 transition-colors duration-200">
                    Search stays
                  </button>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors duration-200">
                    Blog
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-xl mb-5 text-white">Support</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors duration-200">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors duration-200">
                    Safety
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors duration-200">
                    Cancellation
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors duration-200">
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700/50 mt-16 pt-10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-base">
              © 2025 StayLoop. All rights reserved.
            </p>
            <div className="flex gap-8 text-base">
              <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors duration-200 font-medium">
                Privacy Policy
              </a>
              <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors duration-200 font-medium">
                Terms of Service
              </a>
              <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors duration-200 font-medium">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialMode={authMode} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
