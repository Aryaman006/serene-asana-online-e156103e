import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserLayout } from '@/components/layout/UserLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BookOpen, Clock, ChevronRight, GraduationCap } from 'lucide-react';

const MyCoursesPage: React.FC = () => {
  const { user } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) fetchEnrolledCourses();
  }, [user]);

  const fetchEnrolledCourses = async () => {
    setIsLoading(true);
    const { data: purchases } = await supabase
      .from('course_purchases')
      .select('course_id, created_at')
      .eq('user_id', user!.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false });

    if (!purchases || purchases.length === 0) {
      setEnrolledCourses([]);
      setIsLoading(false);
      return;
    }

    const courseIds = purchases.map((p) => p.course_id).filter(Boolean) as string[];
    const { data: courses } = await supabase
      .from('courses')
      .select('*')
      .in('id', courseIds);

    // Merge enrollment date
    const merged = (courses || []).map((c) => {
      const purchase = purchases.find((p) => p.course_id === c.id);
      return { ...c, enrolled_at: purchase?.created_at };
    });

    setEnrolledCourses(merged);
    setIsLoading(false);
  };

  return (
    <UserLayout>
      <section className="py-12 lg:py-16 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="content-container">
          <h1 className="font-display text-4xl md:text-5xl font-bold flex items-center gap-3">
            <GraduationCap className="w-10 h-10 text-primary" />
            My Courses
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Courses you've enrolled in.
          </p>
        </div>
      </section>

      <section className="section-padding">
        <div className="content-container">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-2xl" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : enrolledCourses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledCourses.map((course) => {
                const image = course.featured_image || course.thumbnail;
                return (
                  <Link
                    key={course.id}
                    to={`/courses/${course.slug}`}
                    className="group rounded-2xl overflow-hidden bg-card border border-border hover:border-primary/40 hover:shadow-warm transition-all duration-300 flex flex-col"
                  >
                    <div className="aspect-video overflow-hidden relative">
                      {image ? (
                        <img src={image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <BookOpen className="w-12 h-12 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-green-500 text-white text-xs font-semibold">
                        ✓ Enrolled
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-display text-lg font-semibold group-hover:text-primary transition-colors line-clamp-2">
                        {course.title}
                      </h3>
                      {course.author_name && (
                        <p className="text-sm text-muted-foreground mt-1">by {course.author_name}</p>
                      )}
                      {course.duration && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {course.duration}
                        </p>
                      )}
                      <div className="mt-auto pt-4">
                        <Button size="sm" variant="outline" className="w-full">
                          View Course <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No courses yet</h2>
              <p className="text-muted-foreground mb-6">Browse our catalog and enroll in a course to get started.</p>
              <Button asChild>
                <Link to="/courses">Browse Courses</Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    </UserLayout>
  );
};

export default MyCoursesPage;
