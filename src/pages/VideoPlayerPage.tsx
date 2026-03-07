import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { UserLayout } from '@/components/layout/UserLayout';
import { Button } from '@/components/ui/button';
import { VideoCard } from '@/components/videos/VideoCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Play,
  Pause,
  Crown,
  Sparkles,
  Heart,
  Share2,
  ChevronLeft,
  Check,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string;
  duration_seconds: number;
  is_premium: boolean;
  yogic_points: number;
  category_id: string | null;
  views_count: number | null;
  total_watch_time_seconds: number | null;
  completion_count: number | null;
}

interface WatchProgress {
  watched_seconds: number;
  completed: boolean;
  points_awarded: boolean;
}

const VideoPlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasActiveSubscription, refreshYogicPoints } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [video, setVideo] = useState<Video | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [watchProgress, setWatchProgress] = useState<WatchProgress | null>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Reset state when video id changes
  useEffect(() => {
    setVideo(null);
    setRelatedVideos([]);
    setWatchProgress(null);
    setIsInWishlist(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(true);

    if (id) {
      fetchVideo();
    }
  }, [id]);

  useEffect(() => {
    if (user && id) {
      fetchWatchProgress();
      checkWishlist();
    }
  }, [user, id]);

  const fetchVideo = async () => {
    setIsLoading(true);
    console.log('[VideoPlayer] Fetching video with id:', id);
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle();

    console.log('[VideoPlayer] Fetch result:', { data, error });
    console.log('[VideoPlayer] video_url:', data?.video_url);
    console.log('[VideoPlayer] video_url type:', typeof data?.video_url);
    console.log('[VideoPlayer] video_url length:', data?.video_url?.length);

    if (error || !data) {
      console.error('[VideoPlayer] Video not found or error:', error);
      toast.error('Video not found');
      navigate('/browse');
      return;
    }

    setVideo(data);

    // Fetch related videos
    const { data: related } = await supabase
      .from('videos')
      .select('*')
      .eq('is_published', true)
      .eq('category_id', data.category_id)
      .neq('id', data.id)
      .limit(4);

    setRelatedVideos(related || []);
    setIsLoading(false);

    // Increment view count
    await supabase
      .from('videos')
      .update({ views_count: (data.views_count || 0) + 1 })
      .eq('id', data.id);
  };

  const fetchWatchProgress = async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from('watch_progress')
      .select('watched_seconds, completed, points_awarded')
      .eq('user_id', user.id)
      .eq('video_id', id)
      .maybeSingle();
    setWatchProgress(data);
  };

  const checkWishlist = async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('video_id', id)
      .maybeSingle();
    setIsInWishlist(!!data);
  };

  const saveProgress = useCallback(
    async (seconds: number, completed: boolean = false) => {
      if (!user || !id) return;

      const { data: existing } = await supabase
        .from('watch_progress')
        .select('id')
        .eq('user_id', user.id)
        .eq('video_id', id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('watch_progress')
          .update({
            watched_seconds: seconds,
            completed,
            last_watched_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('watch_progress').insert({
          user_id: user.id,
          video_id: id,
          watched_seconds: seconds,
          completed,
        });
      }

      // Update video total watch time
      if (video) {
        await supabase
          .from('videos')
          .update({
            total_watch_time_seconds: (video.total_watch_time_seconds || 0) + 1,
          })
          .eq('id', video.id);
      }
    },
    [user, id, video]
  );

  const handleVideoComplete = async () => {
    if (!user || !id || !video) return;

    // Save completion
    await saveProgress(video.duration_seconds, true);

    // Award points if not already awarded
    if (!watchProgress?.points_awarded && video.yogic_points > 0) {
       // Call edge function to award points with server-side validation
       const awardResponse = await supabase.functions.invoke('award-yogic-points', {
         body: { videoId: id },
      });

       if (!awardResponse.error && awardResponse.data?.points > 0) {
         toast.success(`🎉 You earned ${awardResponse.data.points} Yogic Points!`, {
          description: 'Great job completing this session!',
        });
        refreshYogicPoints();
      }

      // Update completion count
      await supabase
        .from('videos')
        .update({ completion_count: (video.completion_count || 0) + 1 })
        .eq('id', video.id);
    }
  };

  const toggleWishlist = async () => {
    if (!user || !id) {
      toast.error('Please sign in to add to wishlist');
      return;
    }

    if (isInWishlist) {
      await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', user.id)
        .eq('video_id', id);
      setIsInWishlist(false);
      toast.success('Removed from wishlist');
    } else {
      await supabase
        .from('wishlist')
        .insert({ user_id: user.id, video_id: id });
      setIsInWishlist(true);
      toast.success('Added to wishlist');
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      setCurrentTime(current);

      // Save progress every 10 seconds
      if (Math.floor(current) % 10 === 0 && Math.floor(current) > 0) {
        saveProgress(Math.floor(current));
      }
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    handleVideoComplete();
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (videoRef.current) {
      const newVolume = value[0];
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume || 1;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0
    ? (currentTime / duration) * 100
    : 0;

  // Check if user can watch premium content
  const canWatch = !video?.is_premium || hasActiveSubscription;

  if (isLoading) {
    return (
      <UserLayout>
        <div className="content-container py-8">
          <Skeleton className="aspect-video rounded-2xl mb-8" />
          <Skeleton className="h-8 w-1/2 mb-4" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </UserLayout>
    );
  }

  if (!video) {
    return null;
  }

  // If premium and not subscribed, show upgrade prompt
  if (!canWatch) {
    return (
      <UserLayout>
        <div className="content-container py-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="relative aspect-video rounded-2xl overflow-hidden bg-charcoal mb-8">
            {video.thumbnail_url && (
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="w-full h-full object-cover opacity-50"
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-charcoal/80">
              <Crown className="w-16 h-16 text-gold mb-4" />
              <h2 className="font-display text-3xl font-bold text-white mb-2">
                Premium Content
              </h2>
              <p className="text-white/70 mb-6 max-w-md">
                This video is available exclusively for premium members. 
                Upgrade now to access all premium content.
              </p>
              <Button asChild size="lg" className="bg-gradient-warm">
                <Link to="/subscribe">
                  Upgrade to Premium
                </Link>
              </Button>
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold mb-4">{video.title}</h1>
          <p className="text-muted-foreground">{video.description}</p>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="content-container py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Video Player */}
        <div
          className="relative aspect-video rounded-2xl overflow-hidden bg-charcoal mb-8 group"
          onMouseMove={() => {
            setShowControls(true);
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
          }}
          onMouseLeave={() => setShowControls(false)}
        >
          <video
            ref={videoRef}
            src={video.video_url}
            poster={video.thumbnail_url || undefined}
            className="w-full h-full object-contain"
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              console.log('[VideoPlayer] Metadata loaded, duration:', videoRef.current?.duration);
              if (videoRef.current) {
                setDuration(videoRef.current.duration);
                if (watchProgress?.watched_seconds) {
                  videoRef.current.currentTime = watchProgress.watched_seconds;
                }
              }
            }}
            onEnded={handleVideoEnded}
            onPlay={() => { console.log('[VideoPlayer] Play event fired'); setIsPlaying(true); }}
            onPause={() => { console.log('[VideoPlayer] Pause event fired'); setIsPlaying(false); }}
            onError={(e) => {
              const mediaError = videoRef.current?.error;
              console.error('[VideoPlayer] Video error:', {
                code: mediaError?.code,
                message: mediaError?.message,
                src: video.video_url,
              });
            }}
            onLoadStart={() => console.log('[VideoPlayer] Load started for:', video.video_url)}
            onCanPlay={() => console.log('[VideoPlayer] Video can play')}
          />

          {/* Play/Pause Overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
          >
            {!isPlaying && (
              <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 transition-transform hover:scale-110">
                <Play className="w-10 h-10 text-white fill-white ml-1" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-charcoal/90 to-transparent transition-opacity duration-300',
              showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
            )}
          >
            {/* Progress Bar */}
            <Slider
              value={[currentTime]}
              max={duration}
              step={1}
              onValueChange={handleSeek}
              className="mb-4"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlay}
                  className="text-white hover:bg-white/20"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </Button>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="text-white hover:bg-white/20"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.1}
                    onValueChange={handleVolumeChange}
                    className="w-24"
                  />
                </div>

                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20"
              >
                <Maximize className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Video Info */}
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  {video.is_premium && (
                    <span className="premium-badge flex items-center space-x-1">
                      <Crown className="w-3 h-3" />
                      <span>Premium</span>
                    </span>
                  )}
                  {watchProgress?.completed && (
                    <span className="flex items-center space-x-1 text-sm text-success">
                      <Check className="w-4 h-4" />
                      <span>Completed</span>
                    </span>
                  )}
                </div>
                <h1 className="font-display text-3xl font-bold">{video.title}</h1>
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="outline" size="icon" onClick={toggleWishlist}>
                  <Heart
                    className={cn('w-5 h-5', isInWishlist && 'fill-primary text-primary')}
                  />
                </Button>
                <Button variant="outline" size="icon">
                  <Share2 className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">{video.description}</p>

            {/* Progress Card */}
            <div className="bg-card border border-border rounded-2xl p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium">Your Progress</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progressPercent)}% complete
                </span>
              </div>
              <Progress value={progressPercent} className="h-2 mb-4" />
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2 text-gold">
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {watchProgress?.points_awarded
                      ? `${video.yogic_points} points earned!`
                      : `Complete to earn ${video.yogic_points} points`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Related Videos */}
          {relatedVideos.length > 0 && (
            <div className="lg:w-80">
              <h3 className="font-semibold mb-4">Related Videos</h3>
              <div className="space-y-4">
                {relatedVideos.map((related) => (
                  <VideoCard
                    key={related.id}
                    id={related.id}
                    title={related.title}
                    thumbnailUrl={related.thumbnail_url || undefined}
                    duration={related.duration_seconds}
                    isPremium={related.is_premium}
                    yogicPoints={related.yogic_points}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
};

export default VideoPlayerPage;
