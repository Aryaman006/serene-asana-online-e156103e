import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Home,
  Search,
  Heart,
  History,
  Calendar,
  User,
  LogOut,
  Menu,
  Crown,
  Sparkles,
  Video,
  X,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import playogaLogo from '@/assets/playoga-logo.png';

interface UserLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/browse', label: 'Browse', icon: Search },
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/my-videos', label: 'My Videos', icon: Video },
  { href: '/live', label: 'Live', icon: Calendar },
];

const secondaryNavItems = [
  { href: '/my-courses', label: 'My Courses', icon: GraduationCap },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/history', label: 'History', icon: History },
];

export const UserLayout: React.FC<UserLayoutProps> = ({ children }) => {
  const { user, signOut, hasActiveSubscription, yogicPoints } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-xl">
        <div className="content-container">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <img 
                src={playogaLogo} 
                alt="Playoga" 
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center bg-muted/50 rounded-full px-2 py-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
                    )}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Side */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Secondary Nav (Desktop) */}
              <div className="hidden md:flex items-center gap-1">
                {secondaryNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        isActive
                          ? 'text-primary bg-primary/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                      title={item.label}
                    >
                      <Icon size={20} />
                    </Link>
                  );
                })}
              </div>

              {/* Yogic Points */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20">
                <Sparkles size={14} className="text-gold" />
                <span className="text-sm font-semibold text-gold">{yogicPoints}</span>
              </div>

              {/* Subscription Badge */}
              {hasActiveSubscription && (
                <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/10 to-gold/10 border border-primary/20">
                  <Crown size={14} className="text-primary" />
                  <span className="text-xs font-semibold text-primary">Pro</span>
                </div>
              )}

              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-border hover:ring-primary/50 transition-all">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src="" alt="Avatar" />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-medium">
                          {getInitials(user.email || '')}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.email}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {hasActiveSubscription ? 'Premium Member' : 'Free Account'}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    {!hasActiveSubscription && (
                      <DropdownMenuItem asChild>
                        <Link to="/subscribe" className="flex items-center text-primary">
                          <Crown className="mr-2 h-4 w-4" />
                          Upgrade to Premium
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" asChild size="sm">
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button asChild size="sm" className="bg-gradient-to-r from-primary to-gold hover:opacity-90 shadow-lg shadow-primary/20">
                    <Link to="/signup">Get Started</Link>
                  </Button>
                </div>
              )}

              {/* Mobile Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 p-0">
                  <div className="flex flex-col h-full">
                    {/* Mobile Menu Header */}
                    <div className="flex items-center p-4 border-b border-border">
                      <div className="flex items-center gap-3">
                        <img 
                          src={playogaLogo} 
                          alt="Playoga" 
                          className="h-8 w-auto object-contain"
                        />
                      </div>
                    </div>

                    {/* Points Banner */}
                    <div className="mx-4 mt-4 p-4 rounded-xl bg-gradient-to-r from-gold/10 to-primary/10 border border-gold/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-gold" />
                          <span className="font-medium">Yogic Points</span>
                        </div>
                        <span className="text-xl font-bold text-gold">{yogicPoints}</span>
                      </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex flex-col gap-1 p-4 flex-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Menu
                      </p>
                      {[...navItems, ...secondaryNavItems].map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all',
                              isActive
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            )}
                          >
                            <Icon size={20} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </nav>

                    {/* Mobile Menu Footer */}
                    <div className="p-4 border-t border-border space-y-2">
                      {!hasActiveSubscription && (
                        <Button asChild className="w-full bg-gradient-to-r from-primary to-gold hover:opacity-90">
                          <Link to="/subscribe" onClick={() => setMobileMenuOpen(false)}>
                            <Crown className="mr-2 h-4 w-4" />
                            Upgrade to Premium
                          </Link>
                        </Button>
                      )}
                      {user && (
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => { setMobileMenuOpen(false); handleSignOut(); }}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Sign out
                        </Button>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border mt-20 py-12 bg-muted/30">
        <div className="content-container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <img 
              src={playogaLogo} 
              alt="Playoga" 
              className="h-8 w-auto object-contain"
            />
            <p className="text-sm text-muted-foreground">
              © 2024 Playoga. Your journey to wellness begins here.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
