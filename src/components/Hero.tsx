import { Search, Home, Star, Shield, MapPin } from 'lucide-react';
import { useState } from 'react';

export default function Hero({ onSearch }: { onSearch: (query: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <div className="relative bg-gradient-to-br from-slate-50 via-white to-orange-50 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-rose-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-40">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-100 to-rose-100 backdrop-blur-sm px-5 py-2.5 rounded-full text-sm font-semibold text-orange-700 mb-8 shadow-sm border border-orange-200/50 hover:shadow-md transition-all duration-300">
            <Star className="w-4 h-4 fill-orange-600" />
            Trusted by thousands of travelers worldwide
          </div>

          <h1 className="text-6xl lg:text-8xl font-extrabold text-gray-900 mb-8 leading-tight tracking-tight">
            Find Your Perfect
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 animate-gradient">
              Stay
            </span>
          </h1>

          <p className="text-xl lg:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
            Book unique homes, apartments, and vacation rentals for your next trip.
            <span className="block mt-2 text-gray-500">Experience local living with verified hosts and instant booking.</span>
          </p>

          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto mb-20">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 via-rose-400 to-orange-500 rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition duration-500"></div>
              <div className="relative flex flex-col md:flex-row items-center bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
                <div className="flex-1 relative w-full">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Where do you want to stay?"
                    className="w-full py-7 pl-16 pr-6 text-lg outline-none bg-transparent"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full md:w-auto m-3 px-12 py-5 bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 text-white font-bold rounded-2xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 text-lg"
                >
                  Search
                </button>
              </div>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="group bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-gray-200 hover:border-orange-300 transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl flex items-center justify-center mb-5 mx-auto shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <Home className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Unique Properties</h3>
              <p className="text-gray-600 leading-relaxed">
                From cozy apartments to luxury villas. Find the perfect space for your style and budget.
              </p>
            </div>

            <div className="group bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-gray-200 hover:border-orange-300 transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl flex items-center justify-center mb-5 mx-auto shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Safe & Secure</h3>
              <p className="text-gray-600 leading-relaxed">
                Every property and host is verified. Secure payments and 24/7 customer support for peace of mind.
              </p>
            </div>

            <div className="group bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-gray-200 hover:border-orange-300 transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl flex items-center justify-center mb-5 mx-auto shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Prime Locations</h3>
              <p className="text-gray-600 leading-relaxed">
                Stay in the heart of top destinations. Close to attractions, dining, and local experiences.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
