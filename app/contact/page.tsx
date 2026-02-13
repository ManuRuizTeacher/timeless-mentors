"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Navbar from "../components/Navbar";
import LoginForm from "../components/LoginForm";
import cn from "../utils/cn";

const CONTACT_EMAIL = "vicenteruiz@timelessmentors.eu";

function ContactForm() {
  const { user, profile, loading } = useAuth();
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);

  // Pre-fill from profile and query params
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (profile && !prefilled) {
      setName(profile.name);
      setEmail(profile.email);
      const paramTitle = searchParams.get("title");
      const paramDesc = searchParams.get("description");
      if (paramTitle) setTitle(paramTitle);
      if (paramDesc) setDescription(paramDesc);
      setPrefilled(true);
    }
  }, [profile, prefilled, searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(
      `${t("contact.fieldName")}: ${name}\n${t("contact.fieldEmail")}: ${email}\n\n${description}`
    );
    window.open(
      `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`,
      "_self"
    );
    setSent(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) return <LoginForm />;

  return (
    <main className="min-h-screen bg-primary">
      <Navbar />

      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-sora font-bold text-3xl md:text-4xl mb-2">
            {t("contact.title")}{" "}
            <span className="text-accent">{t("contact.titleAccent")}</span>
          </h1>
          <p className="text-text-secondary text-sm mb-8">
            {t("contact.subtitle")}
          </p>

          {sent ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-teal/20 flex items-center justify-center mx-auto mb-4">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-teal"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="font-sora font-semibold text-lg mb-2">
                {t("contact.sentTitle")}
              </h2>
              <p className="text-text-secondary text-sm mb-6">
                {t("contact.sentMessage")}
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setTitle("");
                  setDescription("");
                }}
                className="text-sm text-accent hover:text-white transition-colors"
              >
                {t("contact.sendAnother")}
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="glass-card rounded-2xl p-8 space-y-5"
            >
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("contact.fieldTitle")}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("contact.fieldTitlePlaceholder")}
                  required
                  className="w-full bg-primary border border-border-subtle rounded-xl px-4 py-3 text-white text-sm placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("contact.fieldName")}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-primary border border-border-subtle rounded-xl px-4 py-3 text-white text-sm placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("contact.fieldEmail")}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-primary border border-border-subtle rounded-xl px-4 py-3 text-white text-sm placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("contact.fieldDescription")}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("contact.fieldDescriptionPlaceholder")}
                  required
                  rows={8}
                  className="w-full bg-primary border border-border-subtle rounded-xl px-4 py-3 text-white text-sm placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!title.trim() || !description.trim()}
                className={cn(
                  "w-full py-3 rounded-full font-medium transition-all duration-300",
                  "bg-accent text-white hover:bg-accent-hover",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {t("contact.submit")}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary flex items-center justify-center">
          <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ContactForm />
    </Suspense>
  );
}
