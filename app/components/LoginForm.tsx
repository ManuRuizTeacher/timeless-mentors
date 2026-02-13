"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import cn from "../utils/cn";

export default function LoginForm() {
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError(t("login.errorInvalidCredentials"));
      } else if (code === "auth/invalid-email") {
        setError(t("login.errorInvalidEmail"));
      } else {
        setError(t("login.errorGeneric"));
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-sora font-bold text-3xl">
            Timeless<span className="text-accent">Mentors</span>
          </h1>
          <p className="text-text-secondary text-sm mt-2">
            {t("login.subtitle")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-card rounded-3xl p-8 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium mb-2">{t("login.email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-primary border border-border-subtle rounded-xl px-4 py-3 text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
              placeholder={t("login.emailPlaceholder")}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t("login.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-primary border border-border-subtle rounded-xl px-4 py-3 text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
              placeholder={t("login.passwordPlaceholder")}
              required
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full py-3 rounded-full font-medium transition-all duration-300",
              "bg-accent text-white hover:bg-accent-hover",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {loading ? t("login.loading") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
