import { supabase } from '../lib/supabase';
import { CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ResetPasswordPage({ onClose }: { onClose: () => void }) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function prepareRecoverySession() {
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (accessToken && refreshToken && type === 'recovery') {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        window.history.replaceState({}, '', '/reset-password');
        setReady(true);
        return;
      }

      const { data, error: sessionLookupError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionLookupError) {
        setError(sessionLookupError.message);
        return;
      }
      if (data.session) {
        setReady(true);
        return;
      }

      setError('This reset link is invalid or has expired. Request a new password reset email.');
    }

    prepareRecoverySession();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 px-4 py-16">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="mt-5 text-3xl font-extrabold text-gray-900">Password updated</h1>
          <p className="mt-3 text-gray-600">Your StayLoop password has been changed. You can sign in with your new password.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 w-full rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3 font-semibold text-white transition hover:from-orange-600 hover:to-rose-600"
          >
            Back to StayLoop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 px-4 py-16">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <h1 className="text-3xl font-extrabold text-gray-900">Choose a new password</h1>
        <p className="mt-2 text-gray-600">Enter a new password for your StayLoop account.</p>

        {!ready ? (
          <div className="mt-8 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-800">
            {error || 'Checking your reset link...'}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">New password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3 font-semibold text-white transition hover:from-orange-600 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Saving password...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
