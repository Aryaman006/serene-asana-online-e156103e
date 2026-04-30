import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BRAND, buildEmail, sendBrandedEmailBatch } from "../_shared/email/brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { course_id } = await req.json().catch(() => ({}));
    if (!course_id) {
      return new Response(JSON.stringify({ error: "course_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: course } = await supabase
      .from("courses")
      .select("id, title, slug, description, thumbnail, featured_image, author_name")
      .eq("id", course_id)
      .single();
    if (!course) {
      return new Response(JSON.stringify({ error: "course not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get enrolled users
    const { data: purchases } = await supabase
      .from("course_purchases")
      .select("user_id")
      .eq("course_id", course_id)
      .eq("status", "completed");

    const userIds = [...new Set((purchases || []).map((p: any) => p.user_id).filter(Boolean))];
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No enrolled users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch emails (up to 1000 enrolled users — chunked safely)
    const emails: string[] = [];
    for (let i = 0; i < userIds.length; i += 200) {
      const slice = userIds.slice(i, i + 200);
      const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      // Cheap path: fall back to admin lookup per ID for accuracy
      for (const uid of slice) {
        const found = data?.users.find((u: any) => u.id === uid);
        if (found?.email) emails.push(found.email);
      }
    }
    const unique = [...new Set(emails)];
    if (unique.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const courseUrl = `${BRAND.url}/courses/${course.slug || course.id}`;
    const heroImage = course.featured_image || course.thumbnail || null;

    const html = buildEmail({
      preheader: `${course.title} has been updated with new content`,
      heading: `${course.title} just got better ✨`,
      intro: `We've refreshed your course "${course.title}" with new content${course.author_name ? ` from ${course.author_name}` : ""}. Pick up right where you left off.`,
      heroImage,
      heroBadge: "Course updated",
      infoRows: [
        { label: "Course", value: course.title },
        ...(course.author_name ? [{ label: "Instructor", value: course.author_name }] : []),
        { label: "Updated", value: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) },
      ],
      cta: { label: "Continue learning", url: courseUrl },
      footerNote: "You're receiving this because you're enrolled in this course.",
    });

    const { sent, failed } = await sendBrandedEmailBatch(
      unique,
      `Updated: ${course.title}`,
      html
    );

    return new Response(JSON.stringify({ success: true, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("notify-course-updated error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
