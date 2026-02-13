"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { AgentData } from "../lib/types";
import { computeAccessibleAgentIds } from "../lib/access";
import cn from "../utils/cn";
import Navbar from "../components/Navbar";
import LoginForm from "../components/LoginForm";

export default function SchoolPage() {
  const { user, profile, school, loading } = useAuth();
  const { t } = useLanguage();
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAgents = async () => {
      try {
        const snapshot = await getDocs(collection(db, "agents"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AgentData[];
        setAgents(data);
      } catch (err) {
        console.error("Error fetching agents:", err);
      }
      setAgentsLoading(false);
    };
    fetchAgents();
  }, [user]);

  const accessibleIds = useMemo(() => {
    if (!profile) return new Set<string>();
    return computeAccessibleAgentIds(agents, school, profile);
  }, [agents, school, profile]);

  const accessibleAgents = useMemo(
    () => agents.filter((a) => accessibleIds.has(a.id)),
    [agents, accessibleIds]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginForm />;
  }

  return (
    <main className="min-h-screen bg-primary">
      <Navbar />

      <section className="pt-32 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-sora font-bold text-3xl md:text-4xl mb-8">
            {t("school.title")}{" "}
            <span className="text-accent">{t("school.titleAccent")}</span>
          </h1>

          {!school ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-text-secondary text-lg">
                {t("school.noSchool")}
              </p>
            </div>
          ) : (
            <>
              {/* School info card */}
              <div className="glass-card rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-4 flex-wrap">
                  <h2 className="font-sora font-semibold text-xl text-white">
                    {school.name}
                  </h2>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                      school.subscriptionPlan === "free" &&
                        "bg-white/10 text-text-secondary border-border-subtle",
                      school.subscriptionPlan === "basic" &&
                        "bg-blue-400/20 text-blue-400 border-blue-400/30",
                      school.subscriptionPlan === "premium" &&
                        "bg-yellow-400/20 text-yellow-400 border-yellow-400/30"
                    )}
                  >
                    {school.subscriptionPlan}
                  </span>
                </div>
              </div>

              {/* Accessible agents */}
              <h3 className="font-sora font-semibold text-lg text-white mb-4">
                {t("school.accessibleAgents")}
              </h3>

              {agentsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : accessibleAgents.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <p className="text-text-secondary">
                    {t("school.noAgents")}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {accessibleAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="glass-card rounded-2xl p-5 flex items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {agent.name}
                        </p>
                        <p className="text-sm text-text-secondary truncate">
                          {agent.title}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                          agent.type === "public" &&
                            "bg-teal/20 text-teal border-teal/30",
                          agent.type === "basic" &&
                            "bg-blue-400/20 text-blue-400 border-blue-400/30",
                          agent.type === "premium" &&
                            "bg-yellow-400/20 text-yellow-400 border-yellow-400/30",
                          agent.type === "custom" &&
                            "bg-purple-400/20 text-purple-400 border-purple-400/30"
                        )}
                      >
                        {agent.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
