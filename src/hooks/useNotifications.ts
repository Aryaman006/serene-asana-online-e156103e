import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { requestNotificationPermission, onForegroundMessage } from "@/lib/firebase";
import { toast } from "sonner";

export function useNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const registerToken = async () => {
      try {
        const token = await requestNotificationPermission();
        if (!token) return;

        // Upsert token with device type
        await supabase.from("device_tokens").upsert(
          { user_id: user.id, token, device_type: "web" },
          { onConflict: "user_id,token" }
        );
      } catch (error) {
        console.error("Failed to register device token:", error);
      }
    };

    registerToken();

    // Handle foreground messages
    const unsubscribe = onForegroundMessage((payload) => {
      toast(payload.notification?.title || "🧘 Playoga", {
        description: payload.notification?.body,
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user]);
}
