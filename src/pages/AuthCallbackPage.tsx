import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Smartphone, TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const APP_SOURCE = 'app';
const DEFAULT_SCHEME = 'myapp';

const getSafeScheme = (value: string | null) => {
  if (!value) return DEFAULT_SCHEME;
  return /^[a-z][a-z0-9+.-]{1,30}$/i.test(value) ? value : DEFAULT_SCHEME;
};

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, session, isLoading, hasPhone } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const source = params.get('source');
  const scheme = getSafeScheme(params.get('scheme'));

  useEffect(() => {
    if (isLoading) return;

    if (!user || !session) {
      navigate(`/login${location.search}`, { replace: true });
      return;
    }

    if (source !== APP_SOURCE) {
      navigate(hasPhone === false ? '/complete-profile' : '/', { replace: true });
      return;
    }

    let cancelled = false;

    const handoffToApp = async () => {
      const { data, error } = await supabase.functions.invoke('create-mobile-auth-code', {
        body: {
          source: APP_SOURCE,
          deepLinkScheme: scheme,
          refreshToken: session.refresh_token,
        },
      });

      if (cancelled) return;

      if (error || !data?.code) {
        console.error('Mobile auth handoff failed:', error);
        setErrorMessage('We could not hand off your sign-in to the mobile app. Please try again.');
        return;
      }

      const deepLink = `${scheme}://auth?code=${encodeURIComponent(data.code)}`;
      setRedirectUrl(deepLink);
      window.location.assign(deepLink);

      window.setTimeout(() => {
        if (cancelled) return;
        setErrorMessage('The app did not open automatically. Tap below to continue in the app.');
      }, 1400);
    };

    handoffToApp().catch((error) => {
      console.error('Unexpected mobile auth handoff error:', error);
      if (!cancelled) {
        setErrorMessage('Something went wrong while preparing your mobile sign-in. Please try again.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hasPhone, isLoading, location.search, navigate, scheme, session, source, user]);

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-sunset p-4">
        <div className="relative z-10 w-full max-w-md">
          <Card className="w-full glass-card">
            <CardHeader className="space-y-3 text-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <TriangleAlert className="w-7 h-7 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-display">App Redirect Needed</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {redirectUrl ? (
                <Button className="w-full" onClick={() => window.location.assign(redirectUrl)}>
                  <Smartphone className="mr-2 h-4 w-4" />
                  Open app
                </Button>
              ) : null}
              <Button variant="outline" className="w-full" onClick={() => navigate('/login', { replace: true })}>
                Back to login
              </Button>
            </CardContent>
            <CardFooter className="justify-center text-xs text-muted-foreground text-center">
              This sign-in code expires quickly and can only be used once.
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-sunset p-4">
      <div className="relative z-10 w-full max-w-md">
        <Card className="w-full glass-card">
          <CardHeader className="space-y-3 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <CardTitle className="text-2xl font-display">Completing Sign-In</CardTitle>
            <CardDescription>
              {source === APP_SOURCE ? 'Sending your secure sign-in code to the mobile app…' : 'Finishing your secure sign-in…'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center text-xs text-muted-foreground text-center">
            You will be redirected automatically.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default AuthCallbackPage;