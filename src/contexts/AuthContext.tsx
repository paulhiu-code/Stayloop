import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

export type UserType = Profile['user_type'];
export type OAuthProvider = 'google' | 'apple';

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, userType: UserType, referralCode?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: OAuthProvider, userType?: UserType) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserType: (userType: UserType) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      const pendingUserType = window.localStorage.getItem('stayloop_pending_user_type') as UserType | null;
      if (data && pendingUserType && data.user_type !== pendingUserType) {
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({ user_type: pendingUserType })
          .eq('id', userId)
          .select('*')
          .maybeSingle();

        if (updateError) throw updateError;
        window.localStorage.removeItem('stayloop_pending_user_type');
        setProfile(updatedProfile);
        return;
      }

      if (pendingUserType) {
        window.localStorage.removeItem('stayloop_pending_user_type');
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string, fullName: string, userType: UserType, referralCode?: string) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          user_type: userType,
          referral_code: referralCode?.toUpperCase() || null,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    // If email confirmation is enabled, Supabase returns a user without a session.
    // In that case, the database trigger stores metadata on profile creation.
    if (!authData.session) return;

    let referrerId = null;
    if (referralCode) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode.toUpperCase())
        .maybeSingle();

      if (referrer) {
        referrerId = referrer.id;
      }
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        referred_by: referrerId,
        user_type: userType,
      })
      .eq('id', authData.user.id);

    if (profileError) throw profileError;
    await fetchProfile(authData.user.id);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async function signInWithOAuth(provider: OAuthProvider, userType?: UserType) {
    if (userType) {
      window.localStorage.setItem('stayloop_pending_user_type', userType);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function updateUserType(userType: UserType) {
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('profiles')
      .update({ user_type: userType })
      .eq('id', user.id);

    if (error) throw error;
    await fetchProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signInWithOAuth, signOut, updateUserType }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
