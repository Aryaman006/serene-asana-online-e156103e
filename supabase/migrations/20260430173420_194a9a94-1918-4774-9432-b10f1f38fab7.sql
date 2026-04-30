-- Add reminder tracking columns for 60-min and 10-min windows
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS reminder_60_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_10_sent boolean NOT NULL DEFAULT false;

-- Trigger function: notify on course updates (when content/title changes on a published course)
CREATE OR REPLACE FUNCTION public.notify_on_course_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.published = true AND (
    OLD.title IS DISTINCT FROM NEW.title
    OR OLD.content IS DISTINCT FROM NEW.content
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.thumbnail IS DISTINCT FROM NEW.thumbnail
  ) THEN
    PERFORM net.http_post(
      url := 'https://xoampivltwofgecadktc.supabase.co/functions/v1/notify-course-updated',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvYW1waXZsdHdvZmdlY2Fka3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxOTg4OTksImV4cCI6MjA4NTc3NDg5OX0.Vo2-tIrsOegAC6aYpmSwa1U6cRQUHbFxszxX2pQuKG4'
      ),
      body := jsonb_build_object('course_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_course_updated ON public.courses;
CREATE TRIGGER trg_notify_on_course_updated
AFTER UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_course_updated();

-- Cron jobs for 60-min and 10-min reminders (30-min already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'session-reminder-60min') THEN
    PERFORM cron.schedule(
      'session-reminder-60min',
      '*/5 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://xoampivltwofgecadktc.supabase.co/functions/v1/send-session-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvYW1waXZsdHdvZmdlY2Fka3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxOTg4OTksImV4cCI6MjA4NTc3NDg5OX0.Vo2-tIrsOegAC6aYpmSwa1U6cRQUHbFxszxX2pQuKG4'
        ),
        body := jsonb_build_object('minutes_before', 60)
      );
      $cron$
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'session-reminder-10min') THEN
    PERFORM cron.schedule(
      'session-reminder-10min',
      '*/2 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://xoampivltwofgecadktc.supabase.co/functions/v1/send-session-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvYW1waXZsdHdvZmdlY2Fka3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxOTg4OTksImV4cCI6MjA4NTc3NDg5OX0.Vo2-tIrsOegAC6aYpmSwa1U6cRQUHbFxszxX2pQuKG4'
        ),
        body := jsonb_build_object('minutes_before', 10)
      );
      $cron$
    );
  END IF;
END $$;