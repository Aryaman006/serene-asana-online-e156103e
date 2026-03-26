import React, { useEffect, useState } from 'react';
import { UserLayout } from '@/components/layout/UserLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Clock, Eye, Tag, Crown, ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  featured_image: string | null;
  duration: string | null;
  price_inr: number | null;
  price_usd: number | null;
  enable_payment: boolean | null;
  published: boolean | null;
  featured: boolean | null;
  views: number | null;
  tags: string[] | null;
  author_name: string | null;
  category_id: string | null;
  payment_title: string | null;
  ai_summary: string | null;
  reading_time: number | null;
}

interface CourseCategory {
  id: string;
  name: string;
  slug: string;
}

const CoursesPage: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [purchasedCourseIds, setPurchasedCourseIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [coursesRes, categoriesRes] = await Promise.all([
        supabase
          .from('courses')
          .select('*')
          .eq('published', true)
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('course_categories').select('*').order('name'),
      ]);

      setCourses(coursesRes.data || []);
      setCategories(categoriesRes.data || []);

      if (user) {
        const { data: purchases } = await supabase
          .from('course_purchases')
          .select('course_id')
          .eq('user_id', user.id)
          .eq('status', 'paid');

        if (purchases) {
          setPurchasedCourseIds(new Set(purchases.map((p) => p.course_id).filter(Boolean) as string[]));
        }
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (course: Course) => {
    if (!user) {
      toast({ title: 'Please log in', description: 'You need to be logged in to purchase a course.', variant: 'destructive' });
      return;
    }

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
              setPurchasedCourseIds((prev) => new Set([...prev, course.id]));
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
    }
  };

  const filteredCourses = courses.filter((course) => {
    const matchesCategory = !selectedCategory || course.category_id === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const featuredCourses = filteredCourses.filter((c) => c.featured);
  const regularCourses = filteredCourses.filter((c) => !c.featured);

  const formatPrice = (course: Course) => {
    if (course.price_inr && course.price_inr > 0) return `₹${course.price_inr}`;
    if (course.price_usd && course.price_usd > 0) return `$${course.price_usd}`;
    return 'Free';
  };

  return (
    <UserLayout>
      {/* Razorpay script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" />

      {/* Hero */}
      <section className="py-12 lg:py-16 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="content-container">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold">
              Explore Our{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                Courses
              </span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Deepen your practice with expert-led courses designed for every level.
            </p>
          </div>

          {/* Search */}
          <div className="mt-8 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </section>

      {/* Category filters */}
      {categories.length > 0 && (
        <section className="border-b border-border">
          <div className="content-container py-4 flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={selectedCategory === null ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(null)}
              className="rounded-full"
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                size="sm"
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat.id)}
                className="rounded-full"
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </section>
      )}

      {/* Featured courses */}
      {featuredCourses.length > 0 && (
        <section className="section-padding">
          <div className="content-container">
            <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
              <Crown className="w-6 h-6 text-primary" />
              Featured Courses
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {featuredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  isPurchased={purchasedCourseIds.has(course.id)}
                  onPurchase={handlePurchase}
                  formatPrice={formatPrice}
                  featured
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All courses */}
      <section className="section-padding bg-muted/30">
        <div className="content-container">
          <h2 className="font-display text-2xl font-bold mb-6">
            {selectedCategory ? 'Filtered Courses' : 'All Courses'}
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-2xl" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : regularCourses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  isPurchased={purchasedCourseIds.has(course.id)}
                  onPurchase={handlePurchase}
                  formatPrice={formatPrice}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No courses found. Try a different search or category.</p>
            </div>
          )}
        </div>
      </section>
    </UserLayout>
  );
};

interface CourseCardProps {
  course: Course;
  isPurchased: boolean;
  onPurchase: (course: Course) => void;
  formatPrice: (course: Course) => string;
  featured?: boolean;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, isPurchased, onPurchase, formatPrice, featured }) => {
  const image = course.featured_image || course.thumbnail;
  const price = formatPrice(course);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-warm transition-all duration-300 flex flex-col ${
        featured ? 'md:flex-row' : ''
      }`}
    >
      {/* Image */}
      <div className={`relative ${featured ? 'md:w-1/2' : ''}`}>
        <div className="aspect-video overflow-hidden">
          {image ? (
            <img src={image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {course.featured && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1">
            <Crown className="w-3 h-3" /> Featured
          </div>
        )}

        {isPurchased && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-green-500 text-white text-xs font-semibold">
            ✓ Enrolled
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`p-5 flex flex-col flex-1 ${featured ? 'md:w-1/2' : ''}`}>
        <h3 className="font-display text-lg font-semibold group-hover:text-primary transition-colors line-clamp-2">
          {course.title}
        </h3>

        {course.author_name && (
          <p className="text-sm text-muted-foreground mt-1">by {course.author_name}</p>
        )}

        {course.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{course.description}</p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
          {course.duration && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {course.duration}
            </span>
          )}
          {course.reading_time && (
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> {course.reading_time} min read
            </span>
          )}
          {(course.views ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> {course.views}
            </span>
          )}
        </div>

        {/* Tags */}
        {course.tags && course.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {course.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-4 flex items-center justify-between">
          {course.enable_payment && !isPurchased ? (
            <>
              <span className="text-lg font-bold text-foreground">{price}</span>
              <Button size="sm" onClick={() => onPurchase(course)} className="bg-gradient-warm hover:opacity-90">
                Enroll Now <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : isPurchased ? (
            <>
              <span className="text-sm text-green-600 font-medium">Access Granted</span>
              <Button size="sm" variant="outline">
                View Course <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-lg font-bold text-green-600">Free</span>
              <Button size="sm" variant="outline">
                View Course <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoursesPage;
