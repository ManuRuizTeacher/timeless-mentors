"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { DailyProvider } from "@daily-co/daily-react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { doc, addDoc, updateDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import VideoBox from "./VideoBox";
import { AgentData } from "../lib/types";
import cn from "../utils/cn";
import { useLanguage } from "../context/LanguageContext";

interface SimliAgentProps {
  mentor: AgentData;
  onClose: () => void;
}


const SimliAgent: React.FC<SimliAgentProps> = ({ mentor, onClose }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [chatbotId, setChatbotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const myCallObjRef = useRef<DailyCall | null>(null);

  // Monitoring refs
  const sessionDocIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  // ── Monitoring helpers ──────────────────────────────────────
  const startMonitoring = useCallback(async () => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, "monitoring"), {
        userId: user.uid,
        agentId: mentor.id,
        agentName: mentor.name,
        startedAt: serverTimestamp(),
        endedAt: null,
        durationSeconds: null,
      });
      sessionDocIdRef.current = docRef.id;
      sessionStartRef.current = Date.now();
    } catch (err) {
      console.error("Error creating monitoring doc:", err);
    }
  }, [user, mentor]);

  const endMonitoring = useCallback(async () => {
    const docId = sessionDocIdRef.current;
    const startMs = sessionStartRef.current;
    if (!docId || !startMs) return;

    // Clear refs immediately to prevent double-ending
    sessionDocIdRef.current = null;
    sessionStartRef.current = null;

    const durationSeconds = Math.round((Date.now() - startMs) / 1000);
    try {
      await updateDoc(doc(db, "monitoring", docId), {
        endedAt: serverTimestamp(),
        durationSeconds,
      });
    } catch (err) {
      console.error("Error updating monitoring doc:", err);
    }
  }, []);

  // End monitoring on page unload or component unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      const docId = sessionDocIdRef.current;
      const startMs = sessionStartRef.current;
      if (!docId || !startMs) return;
      const durationSeconds = Math.round((Date.now() - startMs) / 1000);
      // Use sendBeacon for reliable delivery on page close
      const payload = JSON.stringify({
        docId,
        durationSeconds,
      });
      // Fallback: fire-and-forget updateDoc (may not complete)
      updateDoc(doc(db, "monitoring", docId), {
        endedAt: Timestamp.now(),
        durationSeconds,
      }).catch(() => {});
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Component unmount — end any active session
      if (sessionDocIdRef.current && sessionStartRef.current) {
        const docId = sessionDocIdRef.current;
        const startMs = sessionStartRef.current;
        const durationSeconds = Math.round((Date.now() - startMs) / 1000);
        updateDoc(doc(db, "monitoring", docId), {
          endedAt: Timestamp.now(),
          durationSeconds,
        }).catch(() => {});
      }
    };
  }, []);

  // ── Session handlers ──────────────────────────────────────
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Fetch agent config from Simli to get face_id, voice_id, etc.
      const agentsRes = await fetch("/api/simli/agents");
      if (!agentsRes.ok) throw new Error("Failed to fetch agents");
      const agents = await agentsRes.json();
      const agentConfig = agents.find((a: any) => a.id === mentor.agentId);
      if (!agentConfig) throw new Error("Agent not found in Simli");

      // Step 2: Start session via server-side proxy
      const response = await fetch("/api/simli/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceId: agentConfig.face_id,
          voiceId: agentConfig.voice_id,
          voiceModel: agentConfig.voice_model,
          ttsProvider: agentConfig.voice_provider === "cartesia" ? "Cartesia" : agentConfig.voice_provider === "elevenlabs" ? "ElevenLabs" : "Cartesia",
          language: agentConfig.language || "en",
          systemPrompt: agentConfig.prompt || agentConfig.system_prompt,
          firstMessage: agentConfig.first_message || null,
          maxSessionLength: agentConfig.max_session_length || 3600,
          maxIdleTime: agentConfig.max_idle_time || 300,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || t("simli.errorConnect", { status: String(response.status) }));
      }

      const data = await response.json();
      const roomUrl = data.roomUrl;

      if (!roomUrl) {
        throw new Error(t("simli.errorNoRoom"));
      }

      let newCallObject = DailyIframe.getCallInstance();
      if (newCallObject === undefined) {
        newCallObject = DailyIframe.createCallObject({
          videoSource: false,
        });
      }

      newCallObject.setUserName("User");
      await newCallObject.join({ url: roomUrl });
      myCallObjRef.current = newCallObject;
      setCallObject(newCallObject);

      // Poll for chatbot participant
      pollForChatbot();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("simli.errorUnknown")
      );
      setIsLoading(false);
    }
  }, [mentor, t]);

  const pollCountRef = useRef(0);
  const pollForChatbot = useCallback(() => {
    pollCountRef.current += 1;
    if (myCallObjRef.current) {
      const participants = myCallObjRef.current.participants();
      for (const [, participant] of Object.entries(participants)) {
        if (participant.user_name !== "User" && participant.session_id) {
          setChatbotId(participant.session_id);
          setIsLoading(false);
          setIsConnected(true);
          startMonitoring();
          return;
        }
      }
    }
    if (pollCountRef.current < 120) {
      setTimeout(pollForChatbot, 500);
    } else {
      setError("No se pudo conectar con el avatar. Simli puede estar sin capacidad disponible. Intentalo de nuevo mas tarde.");
      setIsLoading(false);
    }
  }, [startMonitoring]);

  const handleStop = useCallback(async () => {
    await endMonitoring();
    if (callObject) {
      await callObject.leave();
      await callObject.destroy();
      setCallObject(null);
      setChatbotId(null);
      setIsConnected(false);
      setIsLoading(false);
    }
    onClose();
  }, [callObject, onClose, endMonitoring]);

  return (
    <div className="fixed inset-0 z-50 bg-primary/95 backdrop-blur-xl flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <button
          onClick={handleStop}
          className="text-text-secondary hover:text-white transition-colors flex items-center gap-2 text-sm"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("simli.back")}
        </button>

        <div className="text-center">
          <h2 className="font-sora font-bold text-lg">{mentor.name}</h2>
          <p className="text-text-secondary text-xs">{mentor.title}</p>
        </div>

        {/* Spacer to balance the layout */}
        <div className="w-[100px]" />
      </div>

      {/* Video area — fills remaining space */}
      <div className="flex-1 flex items-center justify-center px-6 pb-6 min-h-0">
        <div
          className={cn(
            "rounded-3xl overflow-hidden bg-card-bg border border-card-border transition-all duration-300",
            isConnected && "avatar-glow",
            "w-full max-w-3xl aspect-square max-h-full"
          )}
        >
          {isConnected && callObject ? (
            <DailyProvider callObject={callObject}>
              {chatbotId && <VideoBox id={chatbotId} />}
            </DailyProvider>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-text-secondary text-base">
                    {t("simli.connecting", { name: mentor.name })}
                  </span>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="font-sora font-bold text-5xl text-accent">
                    {mentor.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex flex-col items-center gap-3 px-6 pb-6 flex-shrink-0">
        {/* Error message */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm max-w-lg">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          {!isConnected ? (
            <button
              onClick={handleStart}
              disabled={isLoading}
              className={cn(
                "px-8 py-3 rounded-full font-medium transition-all duration-300",
                "bg-accent text-white hover:bg-accent-hover",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? t("simli.connectingShort") : t("simli.startConversation")}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-8 py-3 rounded-full font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all duration-300"
            >
              {t("simli.endConversation")}
            </button>
          )}
        </div>

        {/* Status indicator */}
        {isConnected && (
          <div className="flex items-center gap-2 text-sm text-teal">
            <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
            {t("simli.inProgress")}
          </div>
        )}
      </div>
    </div>
  );
};

export default SimliAgent;
