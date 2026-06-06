import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth, UserType } from '../contexts/AuthContext';
import { getStoredReferralCode } from '../lib/referral';

export type AuthMode = 'signin' | 'signup';
type JoinIntent = 'guest' | 'host';

const joinIntentOptions: Array<{
  id: JoinIntent;
  title: string;
  copy: string;
}> = [
  {
    id: 'guest',
    title: 'Join as a guest',
    copy: 'Find homes, cabins, beach houses, and city stays.',
  },
  {
    id: 'host',
    title: 'Join as a host',
    copy: 'List properties and keep full guest access automatically.',
  },
];

function userTypeFromIntent(intent: JoinIntent): UserType {
  return intent === 'guest' ? 'guest' : 'both';
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function formatAuthError(err: unknown) {
  const message = err instanceof Error ? err.message : 'An error occurred';

  if (message.toLowerCase().includes('password should contain')) {
    return 'Uppercase, lowercase letters, digits and symbols';
  }

  return message;
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
  const [joinIntent, setJoinIntent] = useState<JoinIntent>('host');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, signInWithOAuth } = useAuth();

  useEffect(() => {
    const storedReferral = getStoredReferralCode();
    if (storedReferral) {
      setReferralCode(storedReferral);
      setJoinIntent('host');
      setIsSignUp(true);
    }
  }, []);

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
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: 'google') {
    setError('');
    setLoading(true);
    try {
      await signInWithOAuth(provider, isSignUp ? userTypeFromIntent(joinIntent) : undefined);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OAuth sign-in failed');
      setLoading(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative my-6 max-h-[calc(100vh-3rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
        onMouseDown={(event) => event.stopPropagation()}
      >
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
                    Host accounts automatically include guest access.
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

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GoogleLogo />
              Continue with Google
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200"></div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>

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
