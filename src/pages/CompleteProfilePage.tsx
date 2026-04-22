import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import playogaLogo from '@/assets/playoga-logo.png';

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[0-9\s-]{7,15}$/, { message: 'Enter a valid phone number' });

const CompleteProfilePage: React.FC = () => {
  const { user, signOut, refreshHasPhone } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid phone');
      return;
    }
    if (!user) return;

    setIsLoading(true);
    const formattedPhone = phone.startsWith('+')
      ? phone.replace(/\s/g, '')
      : `+91${phone.replace(/\s/g, '')}`;

    const { error } = await supabase
      .from('profiles')
      .update({ phone: formattedPhone })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Could not save phone', { description: error.message });
      setIsLoading(false);
      return;
    }

    // Refresh auth state so ProtectedRoute sees the new phone before navigating
    await refreshHasPhone();
    toast.success('Welcome to Playoga!');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-sunset p-4">
      <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-terracotta/10 blur-3xl organic-blob" />
      <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-sage/10 blur-3xl organic-blob-2" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <img src={playogaLogo} alt="Playoga" className="h-16 w-auto mx-auto mb-4 object-contain" />
          <p className="text-muted-foreground mt-2">One last step to get started</p>
        </div>

        <Card className="w-full max-w-md mx-auto glass-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-display text-center">Add your phone number</CardTitle>
            <CardDescription className="text-center">
              We use it for account recovery and important class updates.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="98201 04856"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Indian numbers don’t need a country code — we’ll add +91 for you.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button
                type="submit"
                className="w-full bg-gradient-warm hover:opacity-90 transition-opacity"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  navigate('/login', { replace: true });
                }}
                className="text-xs text-muted-foreground hover:underline"
              >
                Use a different account
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
