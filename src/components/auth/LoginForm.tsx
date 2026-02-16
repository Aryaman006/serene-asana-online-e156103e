import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, Loader2, Phone, Mail } from 'lucide-react';

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
  const { signIn } = useAuth();
  const navigate = useNavigate();

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

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
        ...(isCustomDomain && { skipBrowserRedirect: true }),
      });

      if (error) {
        toast.error('Failed to send reset email', {
          description: error.message,
        });
      } else {
        toast.success('Password reset email sent!', {
          description: `Check your inbox at ${email}`,
        });
      }
    } catch {
      toast.error('An unexpected error occurred');
    }

    setIsResettingPassword(false);
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone.startsWith('+') ? phone : `+91${phone}`,
      });

      if (error) {
        toast.error('Failed to send OTP', { description: error.message });
      } else {
        setOtpSent(true);
        toast.success('OTP sent!', { description: `Check your phone ${phone}` });
      }
    } catch {
      toast.error('An unexpected error occurred');
    }

    setIsLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      toast.error('Please enter the OTP');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone.startsWith('+') ? phone : `+91${phone}`,
        token: otp,
        type: 'sms',
      });

      if (error) {
        toast.error('OTP verification failed', { description: error.message });
      } else {
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch {
      toast.error('An unexpected error occurred');
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
    <Card className="w-full max-w-md mx-auto glass-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-display text-center">Welcome Back</CardTitle>
        <CardDescription className="text-center">
          Sign in to continue your yoga journey
        </CardDescription>
      </CardHeader>

      {/* Login method toggle */}
      <div className="flex mx-6 mb-4 rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => { setLoginMethod('email'); setOtpSent(false); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            loginMethod === 'email'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          <Mail className="w-4 h-4" />
          Email
        </button>
        <button
          type="button"
          onClick={() => { setLoginMethod('phone'); setOtpSent(false); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            loginMethod === 'phone'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          <Phone className="w-4 h-4" />
          Phone
        </button>
      </div>

      {loginMethod === 'email' ? (
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
      ) : (
        <div>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading || otpSent}
              />
            </div>
            {otpSent && (
              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={isLoading}
                  maxLength={6}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            {!otpSent ? (
              <Button
                type="button"
                className="w-full bg-gradient-warm hover:opacity-90 transition-opacity"
                disabled={isLoading}
                onClick={handleSendOtp}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  'Send OTP'
                )}
              </Button>
            ) : (
              <div className="w-full space-y-2">
                <Button
                  type="button"
                  className="w-full bg-gradient-warm hover:opacity-90 transition-opacity"
                  disabled={isLoading}
                  onClick={handleVerifyOtp}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify OTP'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => { setOtpSent(false); setOtp(''); }}
                >
                  Resend OTP
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </div>
      )}
    </Card>
  );
};
