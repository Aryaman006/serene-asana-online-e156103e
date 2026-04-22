import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  hasActiveSubscription: boolean;
  yogicPoints: number;
  hasPhone: boolean | null;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
  refreshYogicPoints: () => Promise<void>;
  refreshHasPhone: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [yogicPoints, setYogicPoints] = useState(0);
  const [hasPhone, setHasPhone] = useState<boolean | null>(null);

  const checkHasPhone = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error) {
        const phoneVal = (data?.phone ?? '').toString().trim();
        setHasPhone(phoneVal.length > 0);
      }
    } catch (e) {
      console.error('Error checking phone:', e);
    }
  };

  const checkSubscriptionStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, expires_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!error && data) {
        const isActive = data.status === 'active' && 
          (data.expires_at === null || new Date(data.expires_at) > new Date());
        setHasActiveSubscription(isActive);
      }
    } catch (e) {
      console.error('Error checking subscription status:', e);
    }
  };

  const fetchYogicPoints = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('yogic_points_transactions')
        .select('points')
        .eq('user_id', userId);
      
      if (!error && data) {
        const total = data.reduce((sum, t) => sum + t.points, 0);
        setYogicPoints(total);
      }
    } catch (e) {
      console.error('Error fetching yogic points:', e);
    }
  };

  const refreshSubscriptionStatus = async () => {
    if (user) {
      await checkSubscriptionStatus(user.id);
    }
  };

  const refreshYogicPoints = async () => {
    if (user) {
      await fetchYogicPoints(user.id);
    }
  };

  const refreshHasPhone = async () => {
    if (user) {
      await checkHasPhone(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid potential race conditions
          setTimeout(() => {
            checkSubscriptionStatus(session.user.id);
            fetchYogicPoints(session.user.id);
            checkHasPhone(session.user.id);
          }, 0);
        } else {
          setHasActiveSubscription(false);
          setYogicPoints(0);
          setHasPhone(null);
        }
        
        setIsLoading(false);
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkSubscriptionStatus(session.user.id);
        fetchYogicPoints(session.user.id);
        checkHasPhone(session.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    try {
      const formattedPhone = phone ? (phone.startsWith('+') ? phone : `+91${phone.replace(/\s/g, '')}`) : '';
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        phone: formattedPhone || undefined,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
            phone: formattedPhone,
          },
        },
      });

      // Phone is already stored in user_metadata via signUp options above

      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        hasActiveSubscription,
        yogicPoints,
        hasPhone,
        signUp,
        signIn,
        signOut,
        refreshSubscriptionStatus,
        refreshYogicPoints,
        refreshHasPhone,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
