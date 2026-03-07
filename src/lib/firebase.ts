import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyApECD0xwSwBncyimpGPLDec5qkV_x2TII",
  authDomain: "playoga-18fde.firebaseapp.com",
  projectId: "playoga-18fde",
  storageBucket: "playoga-18fde.firebasestorage.app",
  messagingSenderId: "177782849041",
  appId: "1:177782849041:web:285beb6baa06a2dd713bb0",
  measurementId: "G-EQF1NH4ND9",
};

const VAPID_KEY = "BNGn8NU6hHOWBNnYr5ihmmUmUJVPhZG1ccRTc6tdwPl0sfYJph1z0sz-E78Z0QP-AID-TgzrX_q52keo63Yf8-Y";

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

let messaging: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
  if (messaging) return messaging;
  try {
    messaging = getMessaging(app);
    return messaging;
  } catch {
    console.warn("Firebase Messaging not supported in this browser");
    return null;
  }
}

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied");
      return null;
    }

    const msg = getMessagingInstance();
    if (!msg) return null;

    // Register the service worker explicitly
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token;
  } catch (error) {
    console.error("Error getting notification token:", error);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  const msg = getMessagingInstance();
  if (!msg) return () => {};
  return onMessage(msg, callback);
}

export { RecaptchaVerifier, signInWithPhoneNumber };
export type { ConfirmationResult };
