"use client";

import { useEffect } from "react";

const firebaseConfig = {
  apiKey: "AIzaSyCHw9UJtOGEFWZtGm_Qpz6Xj29lp_C3u3E",
  authDomain: "sdc-todomanagement.firebaseapp.com",
  projectId: "sdc-todomanagement",
  storageBucket: "sdc-todomanagement.firebasestorage.app",
  messagingSenderId: "775751843100",
  appId: "1:775751843100:web:8cbde9fcf4251824378ed9",
  measurementId: "G-FKLTL3TF39",
};

export function FirebaseAnalytics() {
  useEffect(() => {
    let cancelled = false;
    const start = window.setTimeout(() => {
      void (async () => {
        const [{ getApps, initializeApp }, analytics] = await Promise.all([
          import("firebase/app"),
          import("firebase/analytics"),
        ]);
        if (cancelled) return;
        const app = getApps()[0] ?? initializeApp(firebaseConfig);
        const supported = await analytics.isSupported().catch(() => false);
        if (!cancelled && supported) analytics.getAnalytics(app);
      })();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, []);

  return null;
}
