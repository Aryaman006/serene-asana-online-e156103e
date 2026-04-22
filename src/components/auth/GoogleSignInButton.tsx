import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { lovable } from '@/integrations/lovable';

interface GoogleSignInButtonProps {
  label?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  label = 'Continue with Google',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const source = params.get('source');
      const scheme = params.get('scheme');
      const isAppSource = source === 'app';
      const callbackUrl = new URL('/auth/callback', window.location.origin);

      if (isAppSource) {
        callbackUrl.searchParams.set('source', 'app');
        if (scheme) {
          callbackUrl.searchParams.set('scheme', scheme);
        }
      }

      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: callbackUrl.toString(),
        extraParams: isAppSource ? { prompt: 'select_account' } : undefined,
      });

      if (result.error) {
        toast.error('Sign-in failed', {
          description: result.error.message || 'Please try again.',
        });
        setIsLoading(false);
        return;
      }

      // If browser is redirecting to Google, just wait
      if (result.redirected) return;

      // Tokens received and session set — SPA navigate (no full reload)
      navigate(isAppSource ? `${callbackUrl.pathname}${callbackUrl.search}` : '/', { replace: true });
    } catch (e: any) {
      toast.error('Sign-in failed', {
        description: e?.message || 'Please try again.',
      });
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      className="w-full h-12 bg-card hover:bg-accent/40 border-border"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting…
        </>
      ) : (
        <>
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-2H12z"
            />
          </svg>
          {label}
        </>
      )}
    </Button>
  );
};
