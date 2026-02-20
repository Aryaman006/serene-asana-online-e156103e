import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBjOFEBRLlJSMvCxGQwbqhVb6CisieYc8w",
  authDomain: "playogaapp.firebaseapp.com",
  projectId: "playogaapp",
  storageBucket: "playogaapp.firebasestorage.app",
  messagingSenderId: "572860051568",
  appId: "1:572860051568:web:13421a1780bb4f0c3904b5",
  measurementId: "G-VKP0K7HCGP",
};

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

export { RecaptchaVerifier, signInWithPhoneNumber };
export type { ConfirmationResult };
