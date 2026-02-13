"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { AgentData } from "../lib/types";
import Navbar from "../components/Navbar";
import LoginForm from "../components/LoginForm";
import cn from "../utils/cn";

// ── Types ───────────────────────────────────────────────────

interface MonitoringRecord {
  id: string;
  agentId: string;
  agentName: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
}

// ── Helpers ─────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

const CHART_COLORS = [
  "#3a6ef2",
  "#22d3ee",
  "#a78bfa",
  "#f472b6",
  "#facc15",
  "#34d399",
  "#fb923c",
  "#f87171",
];

// ── Component ───────────────────────────────────────────────

export default function ProfilePage() {
  const { user, profile, school, loading } = useAuth();
  const { t } = useLanguage();

  const [agents, setAgents] = useState<AgentData[]>([]);
  const [records, setRecords] = useState<MonitoringRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  // Fetch agents + monitoring
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        // Agents
        const agSnap = await getDocs(collection(db, "agents"));
        setAgents(
          agSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as AgentData[]
        );

        // Monitoring for this user (no orderBy to avoid composite index)
        const monQ = query(
          collection(db, "monitoring"),
          where("userId", "==", user.uid)
        );
        const monSnap = await getDocs(monQ);
        const monRecords = monSnap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              agentId: data.agentId || "",
              agentName: data.agentName || "",
              startedAt: data.startedAt?.toDate() || new Date(),
              endedAt: data.endedAt?.toDate() || null,
              durationSeconds: data.durationSeconds ?? null,
            };
          })
          .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
        setRecords(monRecords);
      } catch (err) {
        console.error("Error loading profile data:", err);
      }
      setDataLoading(false);
    };
    load();
  }, [user]);

  // Init name input when profile loads
  useEffect(() => {
    if (profile) setNameValue(profile.name);
  }, [profile]);

  // ── Name update ───────────────────────────────────────────

  const handleSaveName = async () => {
    if (!user || !nameValue.trim()) return;
    setNameSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: nameValue.trim(),
      });
      // Reload to propagate
      window.location.reload();
    } catch (err) {
      console.error("Error updating name:", err);
    }
    setNameSaving(false);
  };

  // ── Favorites ─────────────────────────────────────────────

  const favAgents = useMemo(() => {
    if (!profile) return [];
    return agents.filter((a) => profile.fav_agents.includes(a.id));
  }, [agents, profile]);

  // ── Chart data ────────────────────────────────────────────

  const chartData = useMemo(() => {
    const completedRecords = records.filter(
      (r) => r.durationSeconds != null && r.durationSeconds > 0
    );
    if (completedRecords.length === 0) return { days: [], mentors: [], maxSeconds: 0 };

    // Collect unique mentors
    const mentorSet = new Set<string>();
    for (const r of completedRecords) mentorSet.add(r.agentName || r.agentId);
    const mentors = [...mentorSet];

    // Group by day
    const dayMap: Record<string, Record<string, number>> = {};
    for (const r of completedRecords) {
      const dk = toDateKey(r.startedAt);
      if (!dayMap[dk]) dayMap[dk] = {};
      const label = r.agentName || r.agentId;
      dayMap[dk][label] = (dayMap[dk][label] || 0) + (r.durationSeconds || 0);
    }

    // Last 14 days max, sorted ascending
    const sortedDays = Object.keys(dayMap).sort().slice(-14);

    let maxSeconds = 0;
    for (const dk of sortedDays) {
      let dayTotal = 0;
      for (const secs of Object.values(dayMap[dk])) dayTotal += secs;
      if (dayTotal > maxSeconds) maxSeconds = dayTotal;
    }

    const days = sortedDays.map((dk) => ({
      key: dk,
      label: formatDateShort(new Date(dk + "T12:00:00")),
      segments: dayMap[dk],
    }));

    return { days, mentors, maxSeconds };
  }, [records]);

  // ── Guards ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) return <LoginForm />;

  const planLabel = school?.subscriptionPlan ?? "free";
  const recentSessions = records.slice(0, 10);

  // ── Render ────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-primary">
      <Navbar />

      <section className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Header */}
          <h1 className="font-sora font-bold text-3xl md:text-4xl">
            {t("profile.title")}{" "}
            <span className="text-accent">{t("profile.titleAccent")}</span>
          </h1>

          {/* ── Name ───────────────────────────────────────── */}
          <div className="glass-card rounded-2xl p-6">
            <label className="block text-xs text-text-secondary mb-2">
              {t("profile.name")}
            </label>
            {editingName ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="flex-1 bg-primary border border-border-subtle rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent transition-colors"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={nameSaving || !nameValue.trim()}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
                    "bg-accent text-white hover:bg-accent-hover",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {nameSaving ? "..." : t("profile.save")}
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setNameValue(profile.name);
                  }}
                  className="px-4 py-2.5 rounded-full text-sm font-medium bg-white/5 text-text-secondary border border-border-subtle hover:bg-white/10 hover:text-white transition-all duration-300"
                >
                  {t("profile.cancel")}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-white font-medium text-lg">
                  {profile.name}
                </span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-xs text-text-secondary hover:text-accent transition-colors"
                >
                  {t("profile.changeName")}
                </button>
              </div>
            )}
          </div>

          {/* ── School & Plan ──────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-6">
              <label className="block text-xs text-text-secondary mb-2">
                {t("profile.school")}
              </label>
              <span className="text-white font-medium">
                {school?.name || t("profile.noSchool")}
              </span>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <label className="block text-xs text-text-secondary mb-2">
                {t("profile.plan")}
              </label>
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-sm font-semibold uppercase tracking-wider px-3 py-1 rounded-full border",
                    planLabel === "free" &&
                      "bg-white/10 text-text-secondary border-border-subtle",
                    planLabel === "basic" &&
                      "bg-blue-400/20 text-blue-400 border-blue-400/30",
                    planLabel === "premium" &&
                      "bg-yellow-400/20 text-yellow-400 border-yellow-400/30"
                  )}
                >
                  {planLabel}
                </span>
                <Link
                  href={`/contact?title=${encodeURIComponent(t("contact.upgradePlanTitle"))}&description=${encodeURIComponent(t("contact.upgradePlanDescription"))}`}
                  className="text-xs text-accent hover:text-white transition-colors"
                >
                  {t("profile.upgradePlan")}
                </Link>
              </div>
            </div>
          </div>

          {/* ── Favorite mentors ───────────────────────────── */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs text-text-secondary">
                {t("profile.favMentors")}
              </label>
              <Link
                href="/"
                className="text-xs text-accent hover:text-white transition-colors"
              >
                {t("profile.addMoreMentors")}
              </Link>
            </div>

            {dataLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : favAgents.length === 0 ? (
              <p className="text-text-secondary/60 text-sm">
                {t("profile.noFavs")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {favAgents.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-border-subtle"
                  >
                    {a.avatarUrl ? (
                      <img
                        src={a.avatarUrl}
                        alt={a.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                        <span className="text-accent font-sora font-bold text-xs">
                          {a.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <span className="text-sm text-white font-medium">
                      {a.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Usage chart ────────────────────────────────── */}
          <div className="glass-card rounded-2xl p-6">
            <label className="block text-xs text-text-secondary mb-4">
              {t("profile.usageChart")}
            </label>

            {dataLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : chartData.days.length === 0 ? (
              <p className="text-text-secondary/60 text-sm">
                {t("profile.noUsage")}
              </p>
            ) : (
              <>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-5">
                  {chartData.mentors.map((name, i) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor:
                            CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                      <span className="text-[11px] text-text-secondary">
                        {name}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bars */}
                <div className="flex items-end gap-2 h-48">
                  {chartData.days.map((day) => {
                    const dayTotal = Object.values(day.segments).reduce(
                      (s, v) => s + v,
                      0
                    );
                    return (
                      <div
                        key={day.key}
                        className="flex-1 flex flex-col items-center gap-1 min-w-0"
                      >
                        {/* Stacked bar */}
                        <div
                          className="w-full flex flex-col-reverse rounded-t-md overflow-hidden"
                          style={{
                            height: `${Math.max(
                              (dayTotal / chartData.maxSeconds) * 160,
                              4
                            )}px`,
                          }}
                          title={`${day.label}: ${formatDuration(dayTotal)}`}
                        >
                          {chartData.mentors.map((mentor, i) => {
                            const secs = day.segments[mentor] || 0;
                            if (secs === 0) return null;
                            const pct = (secs / dayTotal) * 100;
                            return (
                              <div
                                key={mentor}
                                style={{
                                  height: `${pct}%`,
                                  backgroundColor:
                                    CHART_COLORS[i % CHART_COLORS.length],
                                }}
                                title={`${mentor}: ${formatDuration(secs)}`}
                              />
                            );
                          })}
                        </div>
                        {/* Label */}
                        <span className="text-[9px] text-text-secondary/60 truncate w-full text-center">
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Recent sessions ─────────────────────────────── */}
          <div className="glass-card rounded-2xl p-6">
            <label className="block text-xs text-text-secondary mb-4">
              {t("profile.recentSessions")}
            </label>

            {dataLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentSessions.length === 0 ? (
              <p className="text-text-secondary/60 text-sm">
                {t("profile.noSessions")}
              </p>
            ) : (
              <div className="space-y-2">
                {recentSessions.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 border border-border-subtle"
                  >
                    <span className="text-sm text-white font-medium flex-1 min-w-0 truncate">
                      {r.agentName || r.agentId}
                    </span>
                    <span className="text-xs text-text-secondary/60 font-mono flex-shrink-0">
                      {r.startedAt.toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                      })}{" "}
                      {r.startedAt.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-mono flex-shrink-0",
                        r.durationSeconds != null
                          ? "text-accent"
                          : "text-text-secondary/40"
                      )}
                    >
                      {r.durationSeconds != null
                        ? formatDuration(r.durationSeconds)
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
