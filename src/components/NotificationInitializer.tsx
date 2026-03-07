import { useNotifications } from "@/hooks/useNotifications";

export function NotificationInitializer() {
  useNotifications();
  return null;
}
