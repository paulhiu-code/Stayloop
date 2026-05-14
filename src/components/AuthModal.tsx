import { X } from 'lucide-react';
import { useState } from 'react';
import { useAuth, UserType } from '../contexts/AuthContext';

export type AuthMode = 'signin' | 'signup';
type JoinIntent = 'guest' | 'host' | 'both';

const joinIntentOptions: Array<{
  id: JoinIntent;
  title: string;
  copy: string;
}> = [
  {
    id: 'guest',
    title: 'Book stays',
    copy: 'Find homes, cabins, beach houses, and city stays.',
  },
  {
    id: 'host',
    title: 'List my property',
    copy: 'Bring your rentals onto StayLoop and manage host tools.',
  },
  {
    id: 'both',
    title: 'Both',
    copy: 'Book trips and manage properties from one account.',
  },
];

function userTypeFromIntent(intent: JoinIntent): UserType {
  return intent === 'guest' ? 'guest' : 'both';
}

export default function AuthModal({
  onClose,
  initialMode = 'signin',
}: {
  onClose: () => void;
  initialMode?: AuthMode;
}) {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [joinIntent, setJoinIntent] = useState<JoinIntent>('guest');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, fullName, userTypeFromIntent(joinIntent), referralCode);
      } else {
        await signIn(email, password);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {isSignUp ? 'Join StayLoop' : 'Welcome Back'}
          </h2>
          <p className="text-gray-600">
            {isSignUp
              ? 'Save stays, book trips, or list your property'
              : 'Sign in to access trips, hosting, and payouts'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                  required
                />
              </div>

              <div>
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    How do you want to use StayLoop?
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Hosts automatically keep guest access too.
                  </p>
                </div>
                <div className="grid gap-3">
                  {joinIntentOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setJoinIntent(option.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        joinIntent === option.id
                          ? 'border-orange-400 bg-orange-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-gray-900">{option.title}</div>
                          <div className="mt-1 text-sm text-gray-600">{option.copy}</div>
                        </div>
                        <div
                          className={`mt-1 h-4 w-4 rounded-full border ${
                            joinIntent === option.id
                              ? 'border-orange-500 bg-orange-500'
                              : 'border-gray-300'
                          }`}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              required
            />
          </div>

          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referral Code (Optional)
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition uppercase"
                placeholder="Enter referrer's code"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional for hosts joining through the partner program
              </p>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-rose-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="text-orange-600 hover:text-orange-700 font-medium transition"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
