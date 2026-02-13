"use client";

import { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider, useLanguage, Locale } from "./context/LanguageContext";

const VALID_LOCALES: string[] = ["ca", "es", "en"];

/** Syncs the user's saved locale from Firestore → LanguageContext on login. */
function LanguageSync() {
  const { profile } = useAuth();
  const { setLocale } = useLanguage();

  useEffect(() => {
    if (profile?.locale && VALID_LOCALES.includes(profile.locale)) {
      setLocale(profile.locale as Locale);
    }
  }, [profile?.locale, setLocale]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <LanguageSync />
        {children}
      </AuthProvider>
    </LanguageProvider>
  );
}
