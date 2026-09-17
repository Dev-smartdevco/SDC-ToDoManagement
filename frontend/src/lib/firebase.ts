"use client";

import { useEffect } from "react";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getApps, initializeApp } from "firebase/app";

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
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    isSupported()
      .then((ok) => {
        if (ok) getAnalytics(app);
      })
      .catch(() => undefined);
  }, []);

  return null;
}
