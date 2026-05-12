import { useState } from 'react';
import { Home, DollarSign, TrendingUp, Users, Network, Shield, ArrowRight, Check } from 'lucide-react';
import Header from './Header';
import AuthModal from './AuthModal';

export default function HostsPage({ onClose }: { onClose: () => void }) {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onShowAuth={() => setShowAuth(true)} onShowDashboard={onClose} />

      <div className="relative bg-gradient-to-br from-slate-50 via-white to-orange-50 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-96 h-96 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-96 h-96 bg-rose-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-20 left-1/2 w-96 h-96 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-40">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-100 to-teal-100 backdrop-blur-sm px-5 py-2.5 rounded-full text-sm font-bold text-emerald-700 mb-8 shadow-md border border-emerald-200/50 hover:shadow-lg transition-all duration-300">
              <TrendingUp className="w-4 h-4" />
              Revolutionary Revenue Model
            </div>

            <h1 className="text-6xl lg:text-8xl font-extrabold text-gray-900 mb-8 leading-tight tracking-tight">
              Host. Refer.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 animate-gradient">
                Earn Forever
              </span>
            </h1>

            <p className="text-xl lg:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed font-light">
              List your property and build a passive income stream that grows with every referral.
              <span className="block mt-2 text-gray-500">Earn from your bookings AND from the success of hosts you bring to the platform.</span>
            </p>

            <button
              onClick={() => setShowAuth(true)}
              className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 text-white font-bold rounded-2xl hover:shadow-2xl transition-all duration-300 shadow-xl transform hover:scale-105 text-lg"
            >
              Start Hosting Today
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-extrabold text-gray-900 mb-6">How StayLoop Works for Hosts</h2>
          <p className="text-2xl text-gray-600 font-light">Two ways to earn: from your properties and from your network</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-24">
          <div className="bg-white rounded-3xl p-12 shadow-2xl border-2 border-gray-200 hover:border-orange-300 transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 via-rose-500 to-orange-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl">
              <Home className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-3xl font-extrabold text-gray-900 mb-5">Earn from Your Properties</h3>
            <p className="text-gray-600 mb-8 leading-relaxed text-lg">
              List your properties and start earning immediately. Keep 90% of your booking revenue after our 10% service fee.
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Check className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Competitive 10% commission (vs 15-20% elsewhere)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Fast payouts 24 hours after check-in</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Seamless PMS integration with tools you already use</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-orange-500 via-rose-500 to-orange-600 rounded-3xl p-12 shadow-2xl text-white transform hover:-translate-y-1 transition-all duration-300">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-8 shadow-xl">
              <Network className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-3xl font-extrabold mb-5">Build Your Network</h3>
            <p className="text-white/90 mb-6 leading-relaxed">
              Refer other hosts and earn passive income from EVERY booking they make. 3 levels deep.
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Check className="w-6 h-6 text-white flex-shrink-0 mt-0.5" />
                <span className="text-white/95">3% commission on Level 1 (direct referrals)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-6 h-6 text-white flex-shrink-0 mt-0.5" />
                <span className="text-white/95">2% commission on Level 2 (their referrals)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-6 h-6 text-white flex-shrink-0 mt-0.5" />
                <span className="text-white/95">1% commission on Level 3 (third level down)</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-16 text-white mb-24 overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE4YzAtNi42MjcgNS4zNzMtMTIgMTItMTJzMTIgNS4zNzMgMTIgMTItNS4zNzMgMTItMTIgMTItMTItNS4zNzMtMTItMTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
          <div className="relative max-w-5xl mx-auto">
            <h2 className="text-5xl font-extrabold mb-12 text-center">Real Income Example</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="text-center bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="text-6xl font-extrabold text-orange-400 mb-3">$45,000</div>
                <div className="text-xl text-gray-300 mb-4 font-semibold">Your Property Earnings</div>
                <div className="text-base text-gray-400">5 properties × $9,000/year avg</div>
              </div>
              <div className="text-center bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="text-6xl font-extrabold text-rose-400 mb-3">$18,000</div>
                <div className="text-xl text-gray-300 mb-4 font-semibold">Level 1 Referrals (3%)</div>
                <div className="text-base text-gray-400">10 hosts × $60,000 bookings/year</div>
              </div>
              <div className="text-center bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="text-6xl font-extrabold text-amber-400 mb-3">$24,000</div>
                <div className="text-xl text-gray-300 mb-4 font-semibold">Levels 2 & 3 Combined</div>
                <div className="text-base text-gray-400">Network effect from 30+ hosts</div>
              </div>
            </div>
            <div className="mt-16 pt-12 border-t border-gray-700/50 text-center">
              <div className="text-7xl lg:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-rose-400 to-amber-400 mb-4 animate-gradient">
                $87,000/year
              </div>
              <div className="text-2xl text-gray-300 font-semibold">Total Annual Income Potential</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          <div className="bg-white rounded-3xl p-10 border-2 border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mb-6 shadow-md">
              <DollarSign className="w-7 h-7 text-orange-600" />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-4">Lower Fees</h3>
            <p className="text-gray-600 text-lg leading-relaxed">
              Only 10% commission vs 15-20% on other platforms. Keep more of what you earn.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-10 border-2 border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mb-6 shadow-md">
              <Users className="w-7 h-7 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">No Caps</h3>
            <p className="text-gray-600">
              Unlimited earning potential. No caps on referral income or network size.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-10 border-2 border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mb-6 shadow-md">
              <Shield className="w-7 h-7 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Full Support</h3>
            <p className="text-gray-600">
              24/7 host support, verified guests, and secure payment processing included.
            </p>
          </div>
        </div>

        <div className="relative bg-gradient-to-r from-orange-50 via-rose-50 to-orange-50 rounded-3xl p-16 text-center border-2 border-orange-200 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmOTdhOGQiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzAtNi42MjcgNS4zNzMtMTIgMTItMTJzMTIgNS4zNzMgMTIgMTItNS4zNzMgMTItMTIgMTItMTItNS4zNzMtMTItMTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40"></div>
          <div className="relative">
            <h2 className="text-5xl font-extrabold text-gray-900 mb-6">Ready to Start Earning?</h2>
            <p className="text-2xl text-gray-600 mb-10 max-w-3xl mx-auto font-light">
              Join StayLoop today and build a revenue stream that grows with your network
            </p>
            <button
              onClick={() => setShowAuth(true)}
              className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 text-white font-bold rounded-2xl hover:shadow-2xl transition-all duration-300 shadow-xl transform hover:scale-105 text-lg"
            >
              Get Started Free
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      <footer className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white mt-32 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE4YzAtNi42MjcgNS4zNzMtMTIgMTItMTJzMTIgNS4zNzMgMTIgMTItNS4zNzMgMTItMTIgMTItMTItNS4zNzMtMTItMTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-bold transition-colors duration-200 mb-10 text-lg"
            >
              ← Back to Main Site
            </button>
            <p className="text-gray-400 text-base">© 2025 StayLoop. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
