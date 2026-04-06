import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';

export const SignupForm: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refFromUrl = searchParams.get('ref') || '';
  const [referralCode, setReferralCode] = useState(refFromUrl);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      toast.error('You must agree to the Terms of Use and Privacy Policy');
      return;
    }

    if (!passwordsMatch) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(email, password, fullName, phone);

    if (error) {
      toast.error('Signup failed', {
        description: error.message,
      });
    } else {
      // Process referral and store terms acceptance
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Store terms acceptance
          await supabase
            .from('profiles')
            .update({ terms_accepted: true, terms_accepted_at: new Date().toISOString() })
            .eq('user_id', session.user.id);

          // Process referral if referral code exists
          if (referralCode.trim()) {
            await supabase.rpc('process_referral', {
              _referral_code: referralCode.trim(),
              _referred_user_id: session.user.id,
            });
          }
        }
      } catch (e) {
        console.error('Post-signup processing error:', e);
      }
      toast.success('Account created!', {
        description: 'Please check your email to verify your account.',
      });
      navigate('/login');
    }

    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto glass-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-display text-center">Begin Your Journey</CardTitle>
        <CardDescription className="text-center">
          Create an account to start practicing yoga
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
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
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+91 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setConfirmTouched(true)}
              required
              disabled={isLoading}
              className={
                confirmTouched && confirmPassword.length > 0 && !passwordsMatch
                  ? 'border-destructive ring-destructive focus-visible:ring-destructive'
                  : ''
              }
            />
            {confirmTouched && confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="referralCode">Referral Code (optional)</Label>
            <Input
              id="referralCode"
              type="text"
              placeholder="Enter referral code"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Have a friend's referral code? Enter it here to connect your accounts.
            </p>
          </div>
          <div className="flex items-start space-x-2">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              disabled={isLoading}
              className="mt-0.5"
            />
            <label htmlFor="terms" className="text-sm text-muted-foreground leading-snug cursor-pointer">
              I agree to the{' '}
              <Link to="/terms" className="text-primary hover:underline font-medium" target="_blank">
                Terms of Use
              </Link>{' '}
              and{' '}
              <Link to="/privacy-policy" className="text-primary hover:underline font-medium" target="_blank">
                Privacy Policy
              </Link>
            </label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full bg-gradient-warm hover:opacity-90 transition-opacity"
            disabled={isLoading || !termsAccepted}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
};
