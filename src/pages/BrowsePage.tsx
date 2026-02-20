import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserLayout } from '@/components/layout/UserLayout';
import { VideoCard } from '@/components/videos/VideoCard';
import { CategoryCard } from '@/components/videos/CategoryCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Filter, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Category {
  id: string;
  name: string;
  thumbnail_url: string | null;
  is_featured: boolean;
}

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  is_premium: boolean;
  yogic_points: number;
  category_id: string | null;
}

const BrowsePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryVideoCounts, setCategoryVideoCounts] = useState<Record<string, number>>({});
  const [videos, setVideos] = useState<Video[]>([]);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCategory = searchParams.get('category');
  const sortBy = searchParams.get('sort') || 'recent';
  const filterPremium = searchParams.get('premium');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchVideos();
    } else {
      setVideos([]);
      setIsLoading(false);
    }
  }, [selectedCategory, sortBy, filterPremium, searchQuery]);

  useEffect(() => {
    if (user) {
      fetchWishlist();
    }
  }, [user]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    setCategories(data || []);

    // Fetch video counts per category
    if (data) {
      const counts: Record<string, number> = {};
      for (const cat of data) {
        const { count } = await supabase
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', cat.id)
          .eq('is_published', true);
        counts[cat.id] = count || 0;
      }
      setCategoryVideoCounts(counts);
    }
  };

  const fetchVideos = async () => {
    setIsLoading(true);
    let query = supabase
      .from('videos')
      .select('*')
      .eq('is_published', true);

    if (selectedCategory) {
      query = query.eq('category_id', selectedCategory);
    }

    if (filterPremium === 'free') {
      query = query.eq('is_premium', false);
    } else if (filterPremium === 'premium') {
      query = query.eq('is_premium', true);
    }

    if (searchQuery) {
      query = query.ilike('title', `%${searchQuery}%`);
    }

    switch (sortBy) {
      case 'trending':
        query = query.order('views_count', { ascending: false });
        break;
      case 'popular':
        query = query.order('completion_count', { ascending: false });
        break;
      case 'duration':
        query = query.order('duration_seconds', { ascending: true });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const { data } = await query.limit(50);
    setVideos(data || []);
    setIsLoading(false);
  };

  const fetchWishlist = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wishlist')
      .select('video_id')
      .eq('user_id', user.id);
    setWishlist(new Set(data?.map((w) => w.video_id) || []));
  };

  const toggleWishlist = async (videoId: string) => {
    if (!user) return;

    if (wishlist.has(videoId)) {
      await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', user.id)
        .eq('video_id', videoId);
      setWishlist((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
    } else {
      await supabase
        .from('wishlist')
        .insert({ user_id: user.id, video_id: videoId });
      setWishlist((prev) => new Set(prev).add(videoId));
    }
  };

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory || filterPremium || searchQuery;

  return (
    <UserLayout>
      <div className="content-container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold">Browse Classes</h1>
          <p className="text-muted-foreground mt-2">
            Discover yoga practices tailored to your needs
          </p>
        </div>

        {/* Search and Filters - only show when inside a category */}
        {selectedCategory && (
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={sortBy}
                onValueChange={(value) => updateFilter('sort', value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="trending">Trending</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterPremium || 'all'}
                onValueChange={(value) =>
                  updateFilter('premium', value === 'all' ? null : value)
                }
              >
                <SelectTrigger className="w-32">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Videos</SelectItem>
                  <SelectItem value="free">Free Only</SelectItem>
                  <SelectItem value="premium">Premium Only</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Categories - show when no category is selected */}
        {!selectedCategory && (
          <div>
            <h2 className="font-display text-2xl font-semibold mb-6">Categories</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  id={category.id}
                  name={category.name}
                  thumbnailUrl={category.thumbnail_url || undefined}
                  videoCount={categoryVideoCounts[category.id] || 0}
                  isFeatured={category.is_featured}
                />
              ))}
            </div>
          </div>
        )}

        {/* Selected Category Header + Videos */}
        {selectedCategory && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <Button
                  variant="ghost"
                  onClick={() => updateFilter('category', null)}
                  className="mb-2"
                >
                  ← All Categories
                </Button>
                <h2 className="font-display text-2xl font-semibold">
                  {categories.find((c) => c.id === selectedCategory)?.name}
                </h2>
              </div>
            </div>

            <div>
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="space-y-4">
                      <Skeleton className="aspect-video rounded-2xl" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : videos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {videos.map((video) => (
                    <VideoCard
                      key={video.id}
                      id={video.id}
                      title={video.title}
                      description={video.description || undefined}
                      thumbnailUrl={video.thumbnail_url || undefined}
                      duration={video.duration_seconds}
                      isPremium={video.is_premium}
                      yogicPoints={video.yogic_points}
                      isInWishlist={wishlist.has(video.id)}
                      onWishlistToggle={user ? () => toggleWishlist(video.id) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-muted-foreground text-lg">
                    No videos found in this category.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </UserLayout>
  );
};

export default BrowsePage;
