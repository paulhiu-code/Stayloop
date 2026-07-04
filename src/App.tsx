import { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ThemeSwitcher from './components/ThemeSwitcher';
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
import VariationsPage from './components/VariationsPage';
import { supabase, Property } from './lib/supabase';
import { showcaseProperties } from './data/showcase';
import { searchProperties, type SearchFilters } from './lib/search';
import { buildSearchPath, parseSearchParams } from './lib/searchUrl';
import { withThemeParam } from './themes/url';
import { normalizeAmenities } from './lib/property';
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

function pageFromPath(path: string): SitePage | 'reset-password' | 'admin' | 'demo' {
  if (path === '/admin') return 'admin';
  if (path === '/demo') return 'demo';
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
  page: SitePage | 'reset-password' | 'admin' | 'demo',
  propertyId?: string,
  searchQuery?: string
) {
  if (page === 'admin') return '/admin';
  if (page === 'demo') return '/demo';
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
  const [page, setPage] = useState<SitePage | 'reset-password' | 'admin' | 'demo'>(() => pageFromPath(window.location.pathname));
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
    const path = withThemeParam(buildSearchPath({ ...filters, page: 1 }));
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
        setProperties((data || []).map((property) => ({ ...property, amenities: normalizeAmenities(property.amenities) })));
      } catch (fallbackErr) {
        console.error('Fallback fetch failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  }

  function navigate(nextPage: SitePage | 'reset-password' | 'admin' | 'demo', options?: { propertyId?: string; path?: string }) {
    const path = withThemeParam(
      options?.path ||
        (nextPage === 'admin'
          ? '/admin'
          : nextPage === 'reset-password'
            ? '/reset-password'
            : pathFromPage(nextPage, options?.propertyId))
    );
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
      <div className="page-shell flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="font-medium text-ink-muted">Loading...</p>
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
              className="btn-primary mt-6"
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
              className="btn-primary mt-6"
            >
              Back to homepage
            </button>
          </div>
        </div>
      );
    }

    return <AdminDashboard onClose={() => navigate('home')} adminEmail={profile?.email} />;
  }

  if (page === 'demo') {
    return <VariationsPage onEnterHome={() => navigate('home')} />;
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
    <div className="page-shell">
      <Header
        onShowAuth={openAuth}
        onShowDashboard={() => setShowDashboard(true)}
        onNavigate={navigate}
        onShowAdmin={() => navigate('admin')}
        showAdminLink={isAdmin}
      />

      <Hero onSearch={goToSearch} />

      <main className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="section-label">Featured stays</p>
            <h2 className="section-title mt-3 mb-2">Curated places guests can book next</h2>
            <p className="section-copy">
              Entire homes, hotel rooms, cabins, and unique stays with a professional booking flow.
            </p>
          </div>
          <button type="button" onClick={() => goToSearch({ guests: 1 })} className="btn-primary hidden md:inline-flex">
            Search all stays
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i}>
                <div className="skeleton-block mb-4 aspect-[4/3]" />
                <div className="skeleton-block mb-2 h-6" />
                <div className="skeleton-block h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} onViewStay={viewProperty} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {showcaseProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </main>

      <section className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-label">Featured markets</p>
              <h2 className="section-title mt-4 max-w-2xl">Explore stays in guest-favorite destinations.</h2>
              <p className="section-copy mt-4 max-w-2xl">
                From mountain cabins to Gulf Coast beach houses, browse top markets travelers search for again and again.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => scrollMarkets('left')}
                className="btn-secondary !h-12 !w-12 !rounded-full !p-0"
                aria-label="Scroll markets left"
              >
                ‹
              </button>
              <button
                onClick={() => scrollMarkets('right')}
                className="btn-secondary !h-12 !w-12 !rounded-full !p-0"
                aria-label="Scroll markets right"
              >
                ›
              </button>
            </div>
          </div>

          <div ref={marketCarouselRef} className="scrollbar-hide -mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-6">
            {featuredMarkets.map((market) => (
              <button
                key={market.title}
                onClick={() => goToSearch({ where: market.title, guests: 1 })}
                className="market-card group"
              >
                <div className="relative h-72 overflow-hidden">
                  <img
                    src={market.image}
                    alt={market.title}
                    className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 p-6 text-left text-ink-inverse">
                    <h3 className="text-2xl font-semibold">{market.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/85">{market.stays}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="theme-atlas-only relative overflow-hidden bg-page-muted py-20">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mx-auto max-w-content px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="section-label">StayLoop Care</p>
            <h2 className="section-title mt-4">Book with the confidence every great trip deserves.</h2>
            <p className="section-copy mt-5">
              StayLoop Care brings the practical reassurance guests look for before choosing a place to stay.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {[
              ['Real trip support', 'Get help before, during, and after your stay when questions or travel changes come up.'],
              ['Clear total pricing', 'See nightly rates, cleaning fees, and guest fees before you decide to book.'],
              ['Stay details in one place', 'Keep saved favorites, check-in notes, house rules, and trip updates easy to find.'],
            ].map(([title, copy]) => (
              <div key={title} className="card-surface p-8">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl font-bold text-brand-foreground shadow-brand">
                  ✓
                </div>
                <h3 className="text-2xl font-semibold text-ink">{title}</h3>
                <p className="mt-4 leading-7 text-ink-muted">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="theme-wander-only border-t border-border bg-page-muted py-20">
        <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="section-label">The StayLoop difference</p>
            <h2 className="section-title mt-4">The quality of a luxury hotel. The comfort of a vacation home.</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {[
              ['Real trip support', 'Get help before, during, and after your stay when questions or travel changes come up.'],
              ['Clear total pricing', 'See nightly rates, cleaning fees, and guest fees before you decide to book.'],
              ['Stay details in one place', 'Keep saved favorites, check-in notes, house rules, and trip updates easy to find.'],
            ].map(([title, copy]) => (
              <div key={title} className="card-surface p-8">
                <h3 className="text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-3 leading-7 text-ink-muted">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer-shell">
        <div className="relative mx-auto max-w-content px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
            <div className="col-span-1 md:col-span-2">
              <div className="mb-6 flex items-center gap-3">
                <div className="logo-mark !h-12 !w-12">
                  <span className="text-xl font-bold">S</span>
                </div>
                <span className="text-3xl font-semibold">StayLoop</span>
              </div>
              <p className="mb-8 text-lg leading-relaxed text-white/60">
                Book unique vacation rentals, homes, and experiences around the world. Your perfect stay is just a click away.
              </p>
            </div>

            <div>
              <h3 className="mb-5 text-xl font-semibold">Company</h3>
              <ul className="space-y-3">
                <li>
                  <button onClick={() => navigate('home')} className="text-white/60 transition hover:text-white">
                    About StayLoop
                  </button>
                </li>
                <li>
                  <button onClick={() => goToSearch({ guests: 1 })} className="text-white/60 transition hover:text-white">
                    Search stays
                  </button>
                </li>
                <li>
                  <a href="#" className="text-white/60 transition hover:text-white">
                    Blog
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-5 text-xl font-semibold">Support</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="text-white/60 transition hover:text-white">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/60 transition hover:text-white">
                    Safety
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/60 transition hover:text-white">
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-10 md:flex-row">
            <p className="text-white/60">© 2025 StayLoop. All rights reserved.</p>
            <div className="flex gap-8 text-base">
              <a href="#" className="font-medium text-white/60 transition hover:text-white">
                Privacy Policy
              </a>
              <a href="#" className="font-medium text-white/60 transition hover:text-white">
                Terms of Service
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
      <>
        <AppContent />
        <ThemeSwitcher />
      </>
    </AuthProvider>
  );
}
