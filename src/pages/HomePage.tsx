import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserLayout } from '@/components/layout/UserLayout';
import { VideoCard } from '@/components/videos/VideoCard';
import { CategoryCard } from '@/components/videos/CategoryCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Play, Crown, Sparkles, Calendar, TrendingUp, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import WhatsAppButton from '@/components/WhatsAppButton';
import heroImage from '@/assets/hero2.png';
import { useVisitorTracker } from '@/hooks/useVisitorTracker';

interface Category {
  id: string;
  name: string;
  thumbnail_url: string | null;
  is_featured: boolean;
  video_count?: number;
}

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  is_premium: boolean;
  yogic_points: number;
  views_count: number;
}

interface LiveSession {
  id: string;
  title: string;
  thumbnail_url: string | null;
  instructor_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
  is_premium: boolean;
}

const HomePage: React.FC = () => {
  const { user, hasActiveSubscription } = useAuth();
  const totalVisitors = useVisitorTracker();
  const [featuredCategories, setFeaturedCategories] = useState<Category[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<LiveSession[]>([]);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch featured categories
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .eq('is_featured', true)
        .order('sort_order')
        .limit(4);

      // Fetch video counts per category
      let categoriesWithCounts: Category[] = categories || [];
      if (categories && categories.length > 0) {
        const categoryIds = categories.map((c: Category) => c.id);
        const { data: countData } = await supabase
          .from('videos')
          .select('category_id')
          .eq('is_published', true)
          .in('category_id', categoryIds);

        const countMap: Record<string, number> = {};
        (countData || []).forEach((v: { category_id: string | null }) => {
          if (v.category_id) {
            countMap[v.category_id] = (countMap[v.category_id] || 0) + 1;
          }
        });
        categoriesWithCounts = categories.map((c: Category) => ({
          ...c,
          video_count: countMap[c.id] || 0,
        }));
      }

      // Fetch trending videos (by views)
      const { data: trending } = await supabase
        .from('videos')
        .select('*')
        .eq('is_published', true)
        .order('views_count', { ascending: false })
        .limit(6);

      // Fetch upcoming live sessions
      const { data: sessions } = await supabase
        .from('live_sessions')
        .select('*')
        .gte('scheduled_at', new Date().toISOString())
        .eq('is_completed', false)
        .order('scheduled_at')
        .limit(3);

      // Fetch recent videos
      const { data: recent } = await supabase
        .from('videos')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(6);

      setFeaturedCategories(categoriesWithCounts);
      setTrendingVideos(trending || []);
      setUpcomingSessions(sessions || []);
      setRecentVideos(recent || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatSessionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <UserLayout>
      {/* WhatsApp Button */}
      <WhatsAppButton phoneNumber="919820104856" />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        {/* Dark Overlay for text readability */}
        <div className="absolute inset-0 bg-charcoal/60" />
        
        <div className="content-container relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
              <Sparkles className="w-4 h-4 text-gold" />
              <span className="text-sm text-white/90">Earn Yogic Points with every session</span>
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Transform Your Life Through{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-terracotta-light to-gold">
                Mindful Practice
              </span>
            </h1>
            
            <p className="mt-6 text-lg text-white/70 max-w-xl">
              Join thousands of practitioners on their journey to wellness. 
              Premium yoga classes, live sessions, and personalized recommendations.
            </p>
            
            {totalVisitors !== null && (
              <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mt-4">
                <Users className="w-4 h-4 text-gold" />
                <span className="text-sm text-white/90">
                  {totalVisitors.toLocaleString()} total visitors
                </span>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-4">
              {!user ? (
                <>
                  <Button asChild size="lg" className="bg-gradient-warm hover:opacity-90 text-lg px-8">
                    <Link to="/signup">
                      Start Free Trial
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="bg-white text-charcoal border-white hover:bg-white/90 hover:text-charcoal text-lg px-8">
                    <Link to="/browse">
                      <Play className="mr-2 w-5 h-5" />
                      Browse Classes
                    </Link>
                  </Button>
                </>
              ) : !hasActiveSubscription ? (
                <>
                  <Button asChild size="lg" className="bg-gradient-warm hover:opacity-90 text-lg px-8">
                    <Link to="/subscribe">
                      <Crown className="mr-2 w-5 h-5" />
                      Upgrade to Premium
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="bg-white text-charcoal border-white hover:bg-white/90 hover:text-charcoal text-lg px-8">
                    <Link to="/browse">
                      <Play className="mr-2 w-5 h-5" />
                      Continue Watching
                    </Link>
                  </Button>
                </>
              ) : (
                <Button asChild size="lg" className="bg-gradient-warm hover:opacity-90 text-lg px-8">
                  <Link to="/browse">
                    <Play className="mr-2 w-5 h-5" />
                    Continue Your Practice
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      {featuredCategories.length > 0 && (
        <section className="section-padding">
          <div className="content-container">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-3xl font-bold">Explore Categories</h2>
              <Button variant="ghost" asChild className="text-primary">
                <Link to="/browse">
                  View All <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
                ))
              ) : (
                featuredCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    id={category.id}
                    name={category.name}
                    thumbnailUrl={category.thumbnail_url || undefined}
                    isFeatured={category.is_featured}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Trending Videos */}
      <section className="section-padding bg-muted/30">
        <div className="content-container">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-8 h-8 text-primary" />
              <h2 className="font-display text-3xl font-bold">Trending Now</h2>
            </div>
            <Button variant="ghost" asChild className="text-primary">
              <Link to="/browse?sort=trending">
                View All <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="aspect-video rounded-2xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            ) : trendingVideos.length > 0 ? (
              trendingVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  id={video.id}
                  title={video.title}
                  description={video.description || undefined}
                  thumbnailUrl={video.thumbnail_url || undefined}
                  duration={video.duration_seconds}
                  isPremium={video.is_premium}
                  yogicPoints={video.yogic_points}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">No videos yet. Check back soon!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Upcoming Live Sessions */}
      {upcomingSessions.length > 0 && (
        <section className="section-padding">
          <div className="content-container">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <Calendar className="w-8 h-8 text-accent" />
                <h2 className="font-display text-3xl font-bold">Upcoming Live Classes</h2>
              </div>
              <Button variant="ghost" asChild className="text-primary">
                <Link to="/live">
                  View All <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcomingSessions.map((session) => (
                <Link
                  key={session.id}
                  to="/live"
                  className="group relative overflow-hidden rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-warm transition-all duration-300"
                >
                  <div className="aspect-video relative">
                    {session.thumbnail_url ? (
                      <img
                        src={session.thumbnail_url}
                        alt={session.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-calm flex items-center justify-center">
                        <Calendar className="w-12 h-12 text-white/50" />
                      </div>
                    )}
                    {session.is_premium && (
                      <div className="absolute top-3 left-3 premium-badge flex items-center space-x-1">
                        <Crown className="w-3 h-3" />
                        <span>Premium</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex items-center space-x-1 px-2 py-1 rounded-full bg-destructive text-white text-xs font-medium">
                      <span className="live-pulse w-2 h-2 rounded-full bg-white" />
                      <span>LIVE</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {session.title}
                    </h3>
                    {session.instructor_name && (
                      <p className="text-sm text-muted-foreground mt-1">
                        with {session.instructor_name}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatSessionDate(session.scheduled_at)}
                      </span>
                      <span className="text-muted-foreground">
                        {session.duration_minutes} min
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent Videos */}
      {recentVideos.length > 0 && (
        <section className="section-padding bg-muted/30">
          <div className="content-container">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-3xl font-bold">Recently Added</h2>
              <Button variant="ghost" asChild className="text-primary">
                <Link to="/browse?sort=recent">
                  View All <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  id={video.id}
                  title={video.title}
                  description={video.description || undefined}
                  thumbnailUrl={video.thumbnail_url || undefined}
                  duration={video.duration_seconds}
                  isPremium={video.is_premium}
                  yogicPoints={video.yogic_points}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      {!user && (
        <section className="section-padding">
          <div className="content-container">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-terracotta to-gold p-12 text-center">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
              
              <div className="relative z-10 max-w-2xl mx-auto">
                <h2 className="font-display text-3xl md:text-4xl font-bold text-white">
                  Ready to Transform Your Practice?
                </h2>
                <p className="mt-4 text-white/80">
                  Join Playoga today and get access to hundreds of yoga classes, 
                  live sessions, and personalized recommendations.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <Button asChild size="lg" className="bg-white text-terracotta hover:bg-white/90">
                    <Link to="/signup">
                      Start Free Trial
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </UserLayout>
  );
};

export default HomePage;
