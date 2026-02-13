"use client";

import React, { useRef, useState, useCallback } from "react";
import { DailyProvider } from "@daily-co/daily-react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import VideoBox from "./VideoBox";
import { AgentData } from "../lib/types";
import cn from "../utils/cn";
import { useLanguage } from "../context/LanguageContext";

interface SimliAgentProps {
  mentor: AgentData;
  onClose: () => void;
}

const SIMLI_API_KEY = process.env.NEXT_PUBLIC_SIMLI_API_KEY;

const SimliAgent: React.FC<SimliAgentProps> = ({ mentor, onClose }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [chatbotId, setChatbotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const myCallObjRef = useRef<DailyCall | null>(null);

  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get a session token
      const tokenResponse = await fetch("https://api.simli.ai/auto/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          simliAPIKey: SIMLI_API_KEY,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(t("simli.errorToken", { status: String(tokenResponse.status) }));
      }

      const tokenData = await tokenResponse.json();
      const token = tokenData.session_token;

      // Step 2: Start session using agent_id (loads all config from Simli)
      const response = await fetch(
        `https://api.simli.ai/auto/start/${mentor.agentId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "session-token": token,
          },
        }
      );

      if (!response.ok) {
        throw new Error(t("simli.errorConnect", { status: String(response.status) }));
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

  const pollForChatbot = useCallback(() => {
    if (myCallObjRef.current) {
      const participants = myCallObjRef.current.participants();
      for (const [, participant] of Object.entries(participants)) {
        if (participant.user_name === "Chatbot") {
          setChatbotId(participant.session_id);
          setIsLoading(false);
          setIsConnected(true);
          return;
        }
      }
    }
    setTimeout(pollForChatbot, 500);
  }, []);

  const handleStop = useCallback(async () => {
    if (callObject) {
      await callObject.leave();
      await callObject.destroy();
      setCallObject(null);
      setChatbotId(null);
      setIsConnected(false);
      setIsLoading(false);
    }
    onClose();
  }, [callObject, onClose]);

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
