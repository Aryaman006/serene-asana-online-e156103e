import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VISITOR_ID_KEY = 'playoga_visitor_id';

function generateUUID(): string {
  return crypto.randomUUID();
}

export function useVisitorTracker() {
  const [totalVisitors, setTotalVisitors] = useState<number | null>(null);

  useEffect(() => {
    const trackVisitor = async () => {
      let visitorId = localStorage.getItem(VISITOR_ID_KEY);
      
      if (!visitorId) {
        visitorId = generateUUID();
        localStorage.setItem(VISITOR_ID_KEY, visitorId);
      }

      const { data, error } = await supabase.rpc('register_visitor', {
        _visitor_id: visitorId,
      });

      if (!error && data !== null) {
        setTotalVisitors(data);
      } else {
        // Fallback: just fetch the count
        const { data: count } = await supabase.rpc('get_total_visitors');
        if (count !== null) setTotalVisitors(count);
      }
    };

    trackVisitor();
  }, []);

  return totalVisitors;
}
