
CREATE OR REPLACE FUNCTION public.increment_video_view(_video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.videos
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = _video_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_video_watch_time(_video_id uuid, _seconds integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.videos
  SET total_watch_time_seconds = COALESCE(total_watch_time_seconds, 0) + _seconds
  WHERE id = _video_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_video_completion(_video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.videos
  SET completion_count = COALESCE(completion_count, 0) + 1
  WHERE id = _video_id;
END;
$$;
