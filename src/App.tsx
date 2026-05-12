import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header, { SitePage } from './components/Header';
import Hero from './components/Hero';
import PropertyCard from './components/PropertyCard';
import AuthModal from './components/AuthModal';
import Dashboard from './components/Dashboard';
import HostsPage from './components/HostsPage';
import PartnersPage from './components/PartnersPage';
import { supabase, Property } from './lib/supabase';
import { showcaseProperties } from './data/showcase';

function pageFromPath(path: string): SitePage {
  if (path === '/hosts') return 'hosts';
  if (path === '/partners') return 'partners';
  return 'home';
}

function pathFromPage(page: SitePage) {
  if (page === 'hosts') return '/hosts';
  if (page === 'partners') return '/partners';
  return '/';
}

function AppContent() {
  const [showAuth, setShowAuth] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [page, setPage] = useState<SitePage>(() => pageFromPath(window.location.pathname));
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    const handlePopState = () => setPage(pageFromPath(window.location.pathname));

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    fetchProperties();
  }, []);

  async function fetchProperties(query?: string) {
    setLoading(true);
    try {
      let queryBuilder = supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(12);

      if (query) {
        queryBuilder = queryBuilder.or(
          `title.ilike.%${query}%,city.ilike.%${query}%,state.ilike.%${query}%,description.ilike.%${query}%`
        );
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(query: string) {
    setSearchQuery(query);
    fetchProperties(query);
  }

  function navigate(nextPage: SitePage) {
    window.history.pushState({}, '', pathFromPage(nextPage));
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  if (page === 'hosts') {
    return <HostsPage onClose={() => navigate('home')} onNavigate={navigate} />;
  }

  if (page === 'partners') {
    return <PartnersPage onClose={() => navigate('home')} onNavigate={navigate} onShowAuth={() => setShowAuth(true)} />;
  }

  if (showDashboard) {
    return <Dashboard onClose={() => setShowDashboard(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onShowAuth={() => setShowAuth(true)}
        onShowDashboard={() => setShowDashboard(true)}
        onNavigate={navigate}
      />

      <Hero onSearch={handleSearch} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.24em] text-orange-600">
              {searchQuery ? 'Search results' : 'Featured stays'}
            </p>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-2">
              {searchQuery ? `Places matching "${searchQuery}"` : 'Curated places guests can book next'}
            </h2>
            <p className="text-gray-600">
              {searchQuery
                ? `Found ${properties.length} properties`
                : 'Entire homes, hotel rooms, cabins, and unique stays with a professional booking flow.'}
            </p>
          </div>
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
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : !searchQuery ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {showcaseProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No properties found</h3>
            <p className="text-gray-600 mb-8">
              {searchQuery
                ? 'Try adjusting your search criteria'
                : 'Be the first to list a property'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAuth(true)}
                className="px-8 py-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-rose-600 transition-all shadow-lg hover:shadow-xl"
              >
                Become a Host
              </button>
            )}
          </div>
        )}
      </main>

      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-600">Explore by trip style</p>
              <h2 className="mt-4 max-w-2xl text-4xl font-extrabold tracking-tight text-gray-900">
                Find the right kind of place for every getaway.
              </h2>
            </div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-fit rounded-2xl bg-gray-900 px-7 py-4 font-bold text-white shadow-xl transition hover:bg-gray-800"
            >
              Search stays
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Beach houses',
                copy: 'Ocean views, private decks, and room for the whole crew.',
                image: 'https://images.pexels.com/photos/1438834/pexels-photo-1438834.jpeg?auto=compress&cs=tinysrgb&w=900',
              },
              {
                title: 'Cabins',
                copy: 'Cozy escapes near lakes, trails, fireplaces, and quiet mornings.',
                image: 'https://images.pexels.com/photos/803975/pexels-photo-803975.jpeg?auto=compress&cs=tinysrgb&w=900',
              },
              {
                title: 'Unique stays',
                copy: 'Design homes, desert retreats, tiny homes, and memorable hideaways.',
                image: 'https://images.pexels.com/photos/208736/pexels-photo-208736.jpeg?auto=compress&cs=tinysrgb&w=900',
              },
              {
                title: 'Hotel rooms',
                copy: 'Boutique rooms with polished service for quick trips and weekends.',
                image: 'https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=900',
              },
            ].map((category) => (
              <button
                key={category.title}
                onClick={() => handleSearch(category.title)}
                className="group overflow-hidden rounded-[2rem] bg-gray-950 text-left shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={category.image}
                    alt={category.title}
                    className="h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"></div>
                  <div className="absolute bottom-0 p-6 text-white">
                    <h3 className="text-2xl font-extrabold">{category.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/85">{category.copy}</p>
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
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="max-w-xl">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-600">Plan with confidence</p>
              <h2 className="mt-4 text-4xl font-extrabold text-gray-900">
                Compare favorites, share trip ideas, and book when it feels right.
              </h2>
              <p className="mt-5 text-lg leading-8 text-gray-600">
                Save homes you love, review the full price before checkout, and keep every stay detail in one simple trip view.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Save favorites', 'Create a shortlist of homes, cabins, beach houses, and hotel rooms.'],
                ['Invite your group', 'Share trip options with family or friends before anyone commits.'],
                ['See the total', 'Review nightly rates, cleaning fees, and guest fees before checkout.'],
                ['Travel support', 'Get help before and during your stay if plans change.'],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-[2rem] border border-orange-100 bg-white/80 p-7 shadow-lg backdrop-blur">
                  <h3 className="text-2xl font-extrabold text-gray-900">{title}</h3>
                  <p className="mt-3 leading-7 text-gray-600">{copy}</p>
                </div>
              ))}
            </div>
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
                  <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-gray-400 hover:text-orange-400 transition-colors duration-200">
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

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
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
