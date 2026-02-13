"use client";

import cn from "../utils/cn";
import type { AgentData } from "../lib/types";
import { useLanguage } from "../context/LanguageContext";

// Re-export for backward compatibility
export type { AgentData } from "../lib/types";

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  public: { label: "Public", color: "bg-teal/20 text-teal border-teal/30" },
  basic: { label: "Basic", color: "bg-blue-400/20 text-blue-400 border-blue-400/30" },
  premium: { label: "Premium", color: "bg-yellow-400/20 text-yellow-400 border-yellow-400/30" },
  custom: { label: "Custom", color: "bg-purple-400/20 text-purple-400 border-purple-400/30" },
};

interface AvatarCardProps {
  agent: AgentData;
  unlocked: boolean;
  onSelect: (agent: AgentData) => void;
}

export default function AvatarCard({ agent, unlocked, onSelect }: AvatarCardProps) {
  const { t } = useLanguage();
  const badge = TYPE_BADGE[agent.type] || TYPE_BADGE.public;

  return (
    <div
      className={cn(
        "glass-card rounded-3xl p-6 text-left w-full relative overflow-hidden",
        unlocked ? "cursor-pointer" : "opacity-70"
      )}
      onClick={() => unlocked && onSelect(agent)}
      role={unlocked ? "button" : undefined}
    >
      {/* Lock overlay for locked agents */}
      {!unlocked && (
        <div className="absolute top-4 right-4">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-text-secondary"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
      )}

      {/* Agent type badge */}
      <div className="absolute top-4 left-4">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
            badge.color
          )}
        >
          {badge.label}
        </span>
      </div>

      {/* Avatar placeholder */}
      <div className={cn(
        "w-full aspect-square rounded-2xl mb-5 mt-4 flex items-center justify-center overflow-hidden",
        unlocked
          ? "bg-gradient-to-br from-accent/20 to-primary-light"
          : "bg-gradient-to-br from-gray-800/40 to-primary-light"
      )}>
        {agent.avatarUrl ? (
          <img
            src={agent.avatarUrl}
            alt={agent.name}
            className={cn("w-full h-full object-cover", !unlocked && "grayscale")}
          />
        ) : (
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center",
            unlocked ? "bg-accent/30" : "bg-gray-700/30"
          )}>
            <span className={cn(
              "font-sora font-bold text-3xl",
              unlocked ? "text-accent" : "text-text-secondary"
            )}>
              {agent.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <h3 className={cn(
        "font-sora font-semibold text-lg mb-1 transition-colors",
        unlocked ? "group-hover:text-accent" : "text-text-secondary"
      )}>
        {agent.name}
      </h3>
      <p className="text-sm text-text-secondary mb-3">{agent.title}</p>
      <p className="text-sm text-text-secondary/70 line-clamp-2">
        {agent.description}
      </p>

      {/* CTA */}
      {unlocked ? (
        <div
          className={cn(
            "mt-5 w-full py-3 rounded-full text-center text-sm font-medium",
            "bg-accent/10 text-accent border border-accent/20",
            "hover:bg-accent hover:text-white hover:border-accent",
            "transition-all duration-300"
          )}
        >
          {t("agent.startConversation")}
        </div>
      ) : (
        <a
          href="mailto:vicenteruiz@timelessmentors.eu?subject=Upgrade%20Plan"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "mt-5 w-full py-3 rounded-full text-center text-sm font-medium block",
            "bg-white/5 text-text-secondary border border-border-subtle",
            "hover:bg-white/10 hover:text-white hover:border-white/20",
            "transition-all duration-300"
          )}
        >
          {t("agent.contactSales")}
        </a>
      )}
    </div>
  );
}
