import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserLayout } from '@/components/layout/UserLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Phone,
  Crown,
  Sparkles,
  Calendar,
  Edit2,
  Save,
  X,
  Loader2,
  LogOut,
  Wallet,
  MessageCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface Subscription {
  status: string;
  plan_name: string | null;
  expires_at: string | null;
  starts_at: string | null;
}

const ProfilePage: React.FC = () => {
  const { user, hasActiveSubscription, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, plan_name, expires_at, starts_at')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data as Subscription;
    },
    enabled: !!user,
  });

  const { data: yogicPoints } = useQuery({
    queryKey: ['yogic-points', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase.rpc('get_user_yogic_points', {
        _user_id: user.id,
      });
      if (error) throw error;
      return data as number;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: async () => {
      if (!user) return { videosWatched: 0, totalMinutes: 0, completed: 0 };
      const { data, error } = await supabase
        .from('watch_progress')
        .select('watched_seconds, completed')
        .eq('user_id', user.id);
      if (error) throw error;
      const totalSeconds = data.reduce((acc, p) => acc + (p.watched_seconds || 0), 0);
      return {
        videosWatched: data.length,
        totalMinutes: Math.round(totalSeconds / 60),
        completed: data.filter((p) => p.completed).length,
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async (data: { full_name: string; phone: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated successfully');
      setIsEditing(false);
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const handleSave = () => {
    updateProfile.mutate({ full_name: fullName, phone });
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) {
    return (
      <UserLayout>
        <div className="content-container py-16 text-center">
          <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">My Profile</h1>
          <p className="text-muted-foreground mb-6">
            Please log in to view your profile
          </p>
          <Button asChild>
            <Link to="/login">Log In</Link>
          </Button>
        </div>
      </UserLayout>
    );
  }

  const getInitials = (name: string | null) => {
    if (!name) return user.email?.charAt(0).toUpperCase() || 'U';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <UserLayout>
      <div className="content-container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl font-bold">My Profile</h1>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Profile Card */}
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Profile Information</CardTitle>
                {!isEditing ? (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setFullName(profile?.full_name || '');
                        setPhone(profile?.phone || '');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={updateProfile.isPending}
                    >
                      {updateProfile.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {profileLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row gap-6">
                    <Avatar className="w-24 h-24">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                        {getInitials(profile?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-4">
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Full Name
                        </Label>
                        {isEditing ? (
                          <Input
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="mt-1"
                            placeholder="Enter your name"
                          />
                        ) : (
                          <p className="font-medium mt-1">
                            {profile?.full_name || 'Not set'}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email
                        </Label>
                        <p className="font-medium mt-1">{user.email}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Phone
                        </Label>
                        {isEditing ? (
                          <Input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="mt-1"
                            placeholder="Enter your phone number"
                          />
                        ) : (
                          <p className="font-medium mt-1">
                            {profile?.phone || 'Not set'}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Member Since
                        </Label>
                        <p className="font-medium mt-1">
                          {profile?.created_at
                            ? format(new Date(profile.created_at), 'MMMM d, yyyy')
                            : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats & Subscription */}
            <div className="space-y-6">
              {/* Subscription Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-gold" />
                    Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hasActiveSubscription ? (
                    <div className="space-y-3">
                      <Badge className="bg-success text-white">Active</Badge>
                      <p className="text-sm text-muted-foreground">
                        {subscription?.plan_name || 'Premium'}
                      </p>
                      {subscription?.expires_at && (
                        <p className="text-xs text-muted-foreground">
                          Expires:{' '}
                          {format(new Date(subscription.expires_at), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Badge variant="secondary">Free Plan</Badge>
                      <p className="text-sm text-muted-foreground">
                        Upgrade to access all premium content
                      </p>
                      <Button asChild size="sm" className="w-full bg-gradient-to-r from-primary to-gold hover:opacity-90">
                        <Link to="/subscribe">Upgrade Now</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Yogic Points */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Yogic Points
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">
                    {yogicPoints || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Earned from completing videos
                  </p>
                </CardContent>
              </Card>

              {/* Wallet & Referral */}
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-primary" />
                    Wallet & Referrals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Earn ₹50 for every friend who subscribes using your referral link!
                  </p>
                  <Button asChild size="sm" className="w-full bg-gradient-warm hover:opacity-90">
                    <Link to="/wallet">Go to Wallet</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Help & Support */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-[#25D366]" />
                    Help & Support
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Need help? Chat with our support team on WhatsApp.
                  </p>
                  <Button
                    asChild
                    size="sm"
                    className="w-full bg-[#25D366] hover:bg-[#20BA5C] text-white"
                  >
                    <a
                      href={`https://wa.me/919820104856?text=${encodeURIComponent('Hi Playoga Support, I need help with my account.')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Chat with Support
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* Watch Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Videos Watched</span>
                    <span className="font-medium">{stats?.videosWatched || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="font-medium">{stats?.completed || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Minutes Watched</span>
                    <span className="font-medium">{stats?.totalMinutes || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default ProfilePage;