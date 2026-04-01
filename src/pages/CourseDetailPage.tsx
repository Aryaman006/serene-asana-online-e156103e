import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserLayout } from '@/components/layout/UserLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Clock, Eye, ArrowLeft, CheckCircle, User as UserIcon, Share2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const CourseDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchased, setIsPurchased] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    if (slug) fetchCourse();
  }, [slug, user]);

  const fetchCourse = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('slug', slug!)
      .eq('published', true)
      .single();

    setCourse(data);

    if (data && user) {
      const { data: purchase } = await supabase
        .from('course_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', data.id)
        .eq('status', 'paid')
        .maybeSingle();
      setIsPurchased(!!purchase);
    }
    setIsLoading(false);
  };

  const handleEnroll = async () => {
    if (!user) {
      toast({ title: 'Please log in', description: 'You need to be logged in to enroll.', variant: 'destructive' });
      return;
    }
    if (!course) return;

    setIsPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('course-create-order', {
        body: { courseId: course.id, currency: 'INR' },
      });
      if (error) throw error;

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'Playoga',
        description: data.course_title,
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('course-verify-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                courseId: course.id,
              },
            });
            if (verifyError) throw verifyError;
            if (verifyData.verified) {
              toast({ title: '🎉 Enrolled!', description: `You now have access to "${course.title}"` });
              setIsPurchased(true);
            }
          } catch (err: any) {
            toast({ title: 'Verification failed', description: err.message, variant: 'destructive' });
          }
        },
        prefill: { email: user.email },
        theme: { color: '#F4C968' },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsPurchasing(false);
    }
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = course?.description || `Check out this course: ${course?.title}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast({ title: 'Link copied!', description: 'Course link copied to clipboard.' });
  };

  const handleWhatsAppShare = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${course?.title}\n${shareUrl}`)}`, '_blank');
  };

  const handleTwitterShare = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(course?.title || '')}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const handleFacebookShare = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const formatPrice = () => {
    if (!course) return 'Free';
    if (course.price_inr && course.price_inr > 0) return `₹${course.price_inr}`;
    if (course.price_usd && course.price_usd > 0) return `$${course.price_usd}`;
    return 'Free';
  };

  if (isLoading) {
    return (
      <UserLayout>
        <div className="content-container py-12 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="aspect-video max-w-3xl rounded-2xl" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-40 w-full" />
        </div>
      </UserLayout>
    );
  }

  if (!course) {
    return (
      <UserLayout>
        <div className="content-container py-20 text-center">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Course Not Found</h2>
          <p className="text-muted-foreground mb-6">This course doesn't exist or has been unpublished.</p>
          <Button asChild variant="outline">
            <Link to="/courses"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Courses</Link>
          </Button>
        </div>
      </UserLayout>
    );
  }

  const image = course.featured_image || course.thumbnail;

  return (
    <UserLayout>
      <div className="content-container py-8 lg:py-12">
        {/* Back link */}
        <Link to="/courses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Courses
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image */}
            {image && (
              <div className="aspect-video rounded-2xl overflow-hidden border border-border">
                <img src={image} alt={course.title} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-3xl md:text-4xl font-bold">{course.title}</h1>
              <div className="flex items-center gap-1.5 shrink-0 mt-1">
                <Button variant="outline" size="icon" onClick={handleWhatsAppShare} className="h-9 w-9" title="Share on WhatsApp">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </Button>
                <Button variant="outline" size="icon" onClick={handleTwitterShare} className="h-9 w-9" title="Share on X/Twitter">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </Button>
                <Button variant="outline" size="icon" onClick={handleFacebookShare} className="h-9 w-9" title="Share on Facebook">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </Button>
                <Button variant="outline" size="icon" onClick={handleCopyLink} className="h-9 w-9" title="Copy link">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {course.author_name && (
                <span className="flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4" /> {course.author_name}
                </span>
              )}
              {course.duration && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> {course.duration}
                </span>
              )}
              {course.reading_time && (
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" /> {course.reading_time} min read
                </span>
              )}
              {(course.views ?? 0) > 0 && (
                <span className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" /> {course.views} views
                </span>
              )}
            </div>

            {/* Tags */}
            {course.tags && course.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {course.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            )}

            {/* Description */}
            {course.description && (
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                <h2 className="text-xl font-semibold mb-3">About this course</h2>
                <p className="text-muted-foreground leading-relaxed">{course.description}</p>
              </div>
            )}

            {/* AI Summary */}
            {course.ai_summary && (
              <div className="p-5 rounded-xl bg-primary/5 border border-primary/10">
                <h3 className="font-semibold mb-2 text-primary">AI Summary</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{course.ai_summary}</p>
              </div>
            )}

            {/* Course Content */}
            {(course.content_formatted || course.content) && (
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                <h2 className="text-xl font-semibold mb-3">Course Content</h2>
                <div
                  dangerouslySetInnerHTML={{
                    __html: course.content_formatted || course.content,
                  }}
                />
              </div>
            )}

            {/* Features */}
            {course.features && Array.isArray(course.features) && course.features.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">What you'll learn</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(course.features as string[]).map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 p-6 rounded-2xl border border-border bg-card space-y-5">
              {course.enable_payment && !isPurchased ? (
                <>
                  <div className="text-center">
                    <span className="text-3xl font-bold">{formatPrice()}</span>
                  </div>
                  <Button
                    className="w-full bg-gradient-warm hover:opacity-90 text-lg py-6"
                    onClick={handleEnroll}
                    disabled={isPurchasing}
                  >
                    {isPurchasing ? 'Processing...' : 'Enroll Now'}
                  </Button>
                </>
              ) : isPurchased ? (
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-600 font-semibold">
                    <CheckCircle className="w-5 h-5" /> Enrolled
                  </div>
                  <p className="text-sm text-muted-foreground">You have full access to this course.</p>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <span className="text-2xl font-bold text-green-600">Free</span>
                  <p className="text-sm text-muted-foreground">This course is free for everyone.</p>
                </div>
              )}

              {course.duration && (
                <div className="flex items-center justify-between text-sm border-t border-border pt-4">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{course.duration}</span>
                </div>
              )}
              {course.author_name && (
                <div className="flex items-center justify-between text-sm border-t border-border pt-4">
                  <span className="text-muted-foreground">Author</span>
                  <span className="font-medium">{course.author_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default CourseDetailPage;
