/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyApECD0xwSwBncyimpGPLDec5qkV_x2TII",
  authDomain: "playoga-18fde.firebaseapp.com",
  projectId: "playoga-18fde",
  storageBucket: "playoga-18fde.firebasestorage.app",
  messagingSenderId: "177782849041",
  appId: "1:177782849041:web:285beb6baa06a2dd713bb0",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "🧘 Playoga";
  const options = {
    body: payload.notification?.body || "You have a new notification",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: { url: payload.data?.url || "/live" },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/live";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
