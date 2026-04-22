import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import playogaLogo from '@/assets/playoga-logo.png';

const SignupPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-sunset p-4">
      {/* Decorative blobs */}
      <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-sage/10 blur-3xl organic-blob" />
      <div className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-terracotta/10 blur-3xl organic-blob-2" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={playogaLogo}
            alt="Playoga"
            className="h-16 w-auto mx-auto mb-4 object-contain"
          />
          <p className="text-muted-foreground mt-2">Start your wellness journey today</p>
        </div>

        <Card className="w-full max-w-md mx-auto glass-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-display text-center">Create your account</CardTitle>
            <CardDescription className="text-center">
              One tap to get started — no passwords to remember
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GoogleSignInButton label="Sign up with Google" />
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 text-center">
            <p className="text-xs text-muted-foreground">
              By signing up, you agree to our{' '}
              <Link to="/terms" className="text-primary hover:underline">Terms of Use</Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
