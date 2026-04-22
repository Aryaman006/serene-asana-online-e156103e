import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import playogaLogo from '@/assets/playoga-logo.png';

const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-sunset p-4">
      {/* Decorative blobs */}
      <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-terracotta/10 blur-3xl organic-blob" />
      <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-sage/10 blur-3xl organic-blob-2" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={playogaLogo}
            alt="Playoga"
            className="h-16 w-auto mx-auto mb-4 object-contain"
          />
          <p className="text-muted-foreground mt-2">Your journey to inner peace</p>
        </div>

        <Card className="w-full max-w-md mx-auto glass-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-display text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Sign in with Google to continue your yoga journey
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GoogleSignInButton label="Sign in with Google" />
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 text-center">
            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-primary hover:underline">Terms</Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
