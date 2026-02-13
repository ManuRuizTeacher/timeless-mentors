"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./lib/firebase";
import { useAuth } from "./context/AuthContext";
import { useLanguage } from "./context/LanguageContext";
import { AgentData } from "./lib/types";
import { computeAccessibleAgentIds } from "./lib/access";
import Navbar from "./components/Navbar";
import AvatarCard from "./components/AvatarCard";
import SimliAgent from "./components/SimliAgent";
import LoginForm from "./components/LoginForm";

export default function Home() {
  const { user, profile, school, loading } = useAuth();
  const { t } = useLanguage();
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(true);

  // Fetch agents from Firestore
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

  // Compute accessible agent IDs
  const accessibleIds = useMemo(() => {
    if (!profile) return new Set<string>();
    return computeAccessibleAgentIds(agents, school, profile);
  }, [agents, school, profile]);

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

  const planLabel = school?.subscriptionPlan ?? "free";

  return (
    <main className="min-h-screen bg-primary">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="font-sora font-bold text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight">
            {t("home.title")}{" "}
            <span className="text-accent">{t("home.titleAccent")}</span>
          </h1>
          <p className="text-text-secondary text-lg md:text-xl max-w-2xl mx-auto mb-4">
            {t("home.subtitle")}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary/60">
            <span>
              {t("home.welcome")}{" "}
              <span className="text-white">{profile.name}</span>
            </span>
            <span className="mx-2">|</span>
            <span className="uppercase text-accent text-xs font-semibold tracking-wider">
              {planLabel}
            </span>
            {school && (
              <>
                <span className="mx-2">|</span>
                <span className="text-text-secondary/80 text-xs">
                  {school.name}
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Agent Grid */}
      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          {agentsLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-20 text-text-secondary">
              <p className="text-lg">{t("home.noMentors")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* Unlocked first, then locked */}
              {[...agents]
                .sort((a, b) => {
                  const aUnlocked = accessibleIds.has(a.id);
                  const bUnlocked = accessibleIds.has(b.id);
                  if (aUnlocked && !bUnlocked) return -1;
                  if (!aUnlocked && bUnlocked) return 1;
                  return 0;
                })
                .map((agent) => (
                  <AvatarCard
                    key={agent.id}
                    agent={agent}
                    unlocked={accessibleIds.has(agent.id)}
                    onSelect={setSelectedAgent}
                  />
                ))}
            </div>
          )}
        </div>
      </section>

      {/* Chat overlay */}
      {selectedAgent && (
        <SimliAgent
          mentor={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </main>
  );
}
