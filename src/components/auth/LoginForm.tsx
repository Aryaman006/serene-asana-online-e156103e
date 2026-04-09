import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, Loader2, Phone, Mail } from 'lucide-react';
import { firebaseAuth, RecaptchaVerifier, signInWithPhoneNumber } from '@/lib/firebase';
import type { ConfirmationResult } from '@/lib/firebase';

type LoginMethod = 'email' | 'phone';

export const LoginForm: React.FC = () => {
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Initialize reCAPTCHA verifier
  const setupRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }
    const verifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address first');
      return;
    }

    setIsResettingPassword(true);

    try {
      const isCustomDomain =
        !window.location.hostname.includes('lovable.app') &&
        !window.location.hostname.includes('lovableproject.com') &&
        !window.location.hostname.includes('localhost');

      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
        ...(isCustomDomain && { skipBrowserRedirect: true }),
      });
    } catch {
      // Silently handle errors for security
    }

    // Always show the same message regardless of success/failure
    toast.success('Check your email inbox', {
      description: `If an account exists for ${email}, we've sent a password reset link. If you don't see it, please check your spam folder.`,
      duration: 8000,
    });

    setIsResettingPassword(false);
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    setIsLoading(true);

    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\s/g, '')}`;
      const appVerifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(firebaseAuth, formattedPhone, appVerifier);
      confirmationResultRef.current = result;
      setOtpSent(true);
      toast.success('OTP sent!', { description: `Check your phone ${formattedPhone}` });
    } catch (error: any) {
      console.error('Firebase OTP error:', error);
      toast.error('Failed to send OTP', { description: error?.message || 'Please try again' });
      // Reset recaptcha on error
      recaptchaVerifierRef.current = null;
    }

    setIsLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      toast.error('Please enter the OTP');
      return;
    }

    if (!confirmationResultRef.current) {
      toast.error('Please request OTP first');
      return;
    }

    setIsLoading(true);

    try {
      // Verify OTP with Firebase
      const firebaseResult = await confirmationResultRef.current.confirm(otp);
      const idToken = await firebaseResult.user.getIdToken();
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\s/g, '')}`;

      // Call edge function to create Supabase session
      const { data, error } = await supabase.functions.invoke('firebase-phone-auth', {
        body: { firebaseIdToken: idToken, phone: formattedPhone },
      });

      if (error || data?.error) {
        toast.error('Login failed', { description: data?.error || error?.message });
      } else if (data?.session) {
        // Set the Supabase session
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (error: any) {
      console.error('OTP verify error:', error);
      toast.error('OTP verification failed', { description: error?.message || 'Invalid OTP' });
    }

    setIsLoading(false);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error('Login failed', {
        description: error.message,
      });
    } else {
      toast.success('Welcome back!');
      navigate('/');
    }

    setIsLoading(false);
  };

  return (
    <>
    <div id="recaptcha-container" ref={recaptchaContainerRef}></div>
    <Card className="w-full max-w-md mx-auto glass-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-display text-center">Welcome Back</CardTitle>
        <CardDescription className="text-center">
          Sign in to continue your yoga journey
        </CardDescription>
      </CardHeader>

      {/* Phone login hidden */}

      <form onSubmit={handleEmailSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResettingPassword}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {isResettingPassword ? 'Sending...' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full bg-gradient-warm hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
    </Card>
    </>
  );
};
