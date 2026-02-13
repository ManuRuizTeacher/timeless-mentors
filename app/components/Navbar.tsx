"use client";

import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useLanguage, Locale } from "../context/LanguageContext";

const LOCALES: { code: Locale; label: string }[] = [
  { code: "ca", label: "CA" },
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
];

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const { locale, setLocale, t } = useLanguage();

  const handleLocaleChange = (l: Locale) => {
    setLocale(l);
    if (profile) {
      updateDoc(doc(db, "users", profile.uid), { locale: l }).catch(console.error);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-primary/80 border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-sora font-bold text-xl tracking-tight">
            Timeless<span className="text-accent">Mentors</span>
          </span>
        </Link>
        <div className="flex items-center gap-6">
          {profile && (
            <>
              <span className="text-sm text-text-secondary hidden sm:block">
                {profile.name}
              </span>
              <Link
                href="/school"
                className="text-sm text-text-secondary hover:text-white transition-colors"
              >
                {t("nav.mySchool")}
              </Link>
              {profile.email === "admin@admin.com" && (
                <Link
                  href="/admin"
                  className="text-sm text-accent hover:text-white transition-colors"
                >
                  {t("nav.adminPanel")}
                </Link>
              )}
              <a
                href="https://www.timelessmentors.eu/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-secondary hover:text-white transition-colors"
              >
                {t("nav.webPrincipal")}
              </a>
              <div className="flex items-center gap-1">
                {LOCALES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => handleLocaleChange(l.code)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      locale === l.code
                        ? "text-accent font-semibold"
                        : "text-text-secondary hover:text-white"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <button
                onClick={signOut}
                className="text-sm text-text-secondary hover:text-red-400 transition-colors"
              >
                {t("nav.signOut")}
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
