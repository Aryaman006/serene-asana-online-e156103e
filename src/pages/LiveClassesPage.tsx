import React from "react";
import { useQuery } from "@tanstack/react-query";
import { UserLayout } from "@/components/layout/UserLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, isPast, isFuture, isToday, addMinutes } from "date-fns";
import { Calendar, Clock, Users, Play, Bell, Crown, Loader2, Radio, Share2 } from "lucide-react";
import { Link } from "react-router-dom";

interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  instructor_name: string | null;
  thumbnail_url: string | null;
  is_live: boolean | null;
  is_completed: boolean | null;
  is_premium: boolean | null;
  max_participants: number | null;
  stream_url: string | null;
}

interface Registration {
  session_id: string;
}

const LiveClassesPage: React.FC = () => {
  const { user, hasActiveSubscription } = useAuth();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["live-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data as LiveSession[];
    },
  });

  console.log(sessions);

  const { data: registrations, refetch: refetchRegistrations } = useQuery({
    queryKey: ["my-registrations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("live_session_registrations")
        .select("session_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as Registration[];
    },
    enabled: !!user,
  });

  const registeredSessionIds = new Set(registrations?.map((r) => r.session_id) || []);

  const handleRegister = async (sessionId: string, isPremium: boolean | null) => {
    if (!user) {
      toast.error("Please log in to register");
      return;
    }

    if (isPremium && !hasActiveSubscription) {
      toast.error("Premium subscription required for this session");
      return;
    }

    try {
      const { error } = await supabase.from("live_session_registrations").insert({
        session_id: sessionId,
        user_id: user.id,
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("Already registered for this session");
        } else {
          throw error;
        }
      } else {
        toast.success("Registered successfully!");
        refetchRegistrations();
      }
    } catch (err) {
      console.error("Registration error:", err);
      toast.error("Failed to register");
    }
  };

  const handleUnregister = async (sessionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("live_session_registrations")
        .delete()
        .eq("session_id", sessionId)
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Unregistered from session");
      refetchRegistrations();
    } catch (err) {
      console.error("Unregister error:", err);
      toast.error("Failed to unregister");
    }
  };

  const handleShare = async (session: LiveSession) => {
    const shareUrl = `${window.location.origin}/live?session=${session.id}`;
    const shareData = {
      title: session.title,
      text: `Join this Playoga live class: ${session.title}`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast.success("Live class link copied");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Share error:", err);
        toast.error("Could not share this class");
      }
    }
  };

  // Helper to check if session has ended (scheduled_at + duration has passed)
  const isSessionEnded = (session: LiveSession) => {
    const sessionEnd = addMinutes(new Date(session.scheduled_at), session.duration_minutes || 60);
    return session.is_completed || isPast(sessionEnd);
  };

  // Helper to check if session is in progress (started but not ended)
  const isSessionInProgress = (session: LiveSession) => {
    const sessionStart = new Date(session.scheduled_at);
    const sessionEnd = addMinutes(sessionStart, session.duration_minutes || 60);
    return isPast(sessionStart) && !isPast(sessionEnd) && !session.is_completed;
  };

  const upcomingSessions = sessions?.filter((s) => !s.is_completed && isFuture(new Date(s.scheduled_at)));
  const liveSessions = sessions?.filter((s) => s.is_live || isSessionInProgress(s));
  const pastSessions = sessions?.filter((s) => isSessionEnded(s));

  const renderSession = (session: LiveSession) => {
    const isRegistered = registeredSessionIds.has(session.id);
    const sessionDate = new Date(session.scheduled_at);
    const inProgress = session.is_live || isSessionInProgress(session);
    const canJoin = inProgress && isRegistered;
    const isPastSession = isSessionEnded(session);

    return (
      <Card key={session.id} className="overflow-hidden flex flex-col">
        <div className="relative">
          <div
            className="h-36 sm:h-44 md:h-48 bg-cover bg-center"
            style={{
              backgroundImage: session.thumbnail_url
                ? `url(${session.thumbnail_url})`
                : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-foreground)))",
            }}
          />
          {(session.is_live || inProgress) && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-red-500 text-white animate-pulse">
                <Radio className="w-3 h-3 mr-1" />
                {session.is_live ? "LIVE NOW" : "IN PROGRESS"}
              </Badge>
            </div>
          )}
          {session.is_premium && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-gold text-charcoal">
                <Crown className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            </div>
          )}
        </div>
        <CardContent className="p-4 sm:p-5 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-1 sm:mb-2">
            <h3 className="font-display text-base sm:text-lg font-semibold line-clamp-1">{session.title}</h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => handleShare(session)}
              aria-label={`Share ${session.title}`}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
          {session.description && (
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">{session.description}</p>
          )}

          <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{isToday(sessionDate) ? "Today" : format(sessionDate, "EEE, MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                {format(sessionDate, "h:mm a")} ({session.duration_minutes || 60} min)
              </span>
            </div>
            {session.instructor_name && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>with {session.instructor_name}</span>
              </div>
            )}
          </div>

          {!isPastSession && (
            <div className="flex gap-2 mt-auto">
              {canJoin ? (
                <Button asChild className="flex-1 bg-gradient-warm">
                  <a href={session.stream_url || "#"} target="_blank" rel="noopener noreferrer">
                    <Play className="w-4 h-4 mr-2" />
                    Join Now
                  </a>
                </Button>
              ) : isRegistered ? (
                <Button variant="outline" className="flex-1" onClick={() => handleUnregister(session.id)}>
                  <Bell className="w-4 h-4 mr-2" />
                  Registered
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  onClick={() => handleRegister(session.id, session.is_premium)}
                  disabled={session.is_premium && !hasActiveSubscription}
                >
                  {session.is_premium && !hasActiveSubscription ? (
                    <>
                      <Crown className="w-4 h-4 mr-2" />
                      Premium Only
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Register
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {isPastSession && (
            <Badge variant="secondary" className="w-full justify-center py-2">
              Session Ended
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <UserLayout>
      <div className="content-container py-4 sm:py-8 px-3 sm:px-4">
        <div className="mb-5 sm:mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Live Classes</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Join live yoga sessions with our expert instructors</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Live Now */}
            {liveSessions && liveSessions.length > 0 && (
              <section className="mb-10">
                <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
                  <Radio className="w-5 h-5 text-red-500" />
                  Live Now
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">{liveSessions.map(renderSession)}</div>
              </section>
            )}

            {/* Upcoming Sessions */}
            <section className="mb-10">
              <h2 className="font-display text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Upcoming Sessions</h2>
              {upcomingSessions && upcomingSessions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">{upcomingSessions.map(renderSession)}</div>
              ) : (
                <Card className="p-8 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No upcoming sessions scheduled.</p>
                  <p className="text-sm text-muted-foreground mt-1">Check back soon for new live classes!</p>
                </Card>
              )}
            </section>

            {/* Past Sessions */}
            {pastSessions && pastSessions.length > 0 && (
              <section>
                <h2 className="font-display text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-muted-foreground">Past Sessions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 opacity-60">
                  {pastSessions.slice(0, 6).map(renderSession)}
                </div>
              </section>
            )}
          </>
        )}

        {/* Premium CTA */}
        {!hasActiveSubscription && (
          <div className="mt-8 sm:mt-12 p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-charcoal to-terracotta-dark text-white text-center">
            <Crown className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 sm:mb-4 text-gold" />
            <h3 className="font-display text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Unlock All Live Sessions</h3>
            <p className="text-white/70 mb-4 sm:mb-6 max-w-md mx-auto text-sm sm:text-base">
              Get access to exclusive premium live classes with our top instructors
            </p>
            <Button asChild size="lg" className="bg-white text-charcoal hover:bg-white/90">
              <Link to="/subscribe">Subscribe Now</Link>
            </Button>
          </div>
        )}
      </div>
    </UserLayout>
  );
};

export default LiveClassesPage;
