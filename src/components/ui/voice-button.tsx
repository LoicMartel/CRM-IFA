"use client";

import { Mic, MicOff, Loader2 } from "lucide-react";

export type VoiceTone = "professional" | "friendly" | "concise" | "detailed" | "neutral";

const TONE_OPTIONS: { value: VoiceTone; label: string }[] = [
  { value: "neutral", label: "Neutre" },
  { value: "professional", label: "Professionnel" },
  { value: "friendly", label: "Amical" },
  { value: "concise", label: "Concis" },
  { value: "detailed", label: "Détaillé" },
];

export function VoiceButton({
  isRecording,
  isFormatting,
  onClick,
  tone,
  onToneChange,
}: {
  isRecording: boolean;
  isFormatting?: boolean;
  onClick: () => void;
  tone?: VoiceTone;
  onToneChange?: (tone: VoiceTone) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={isFormatting}
        style={{
          height: 36, width: 36, borderRadius: "50%", border: "none", cursor: isFormatting ? "wait" : "pointer",
          background: isFormatting ? "#95a5a6" : isRecording ? "#e74c3c" : "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
          color: "white", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isRecording ? "0 0 0 4px rgba(231,76,60,0.2)" : "none",
          animation: isRecording ? "pulse 1.5s infinite" : "none",
          flexShrink: 0,
          opacity: isFormatting ? 0.7 : 1,
        }}
      >
        {isFormatting ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
      <span style={{ fontSize: 12, color: isFormatting ? "#3498db" : isRecording ? "#e74c3c" : "#8399a9", fontWeight: isRecording || isFormatting ? 600 : 400 }}>
        {isFormatting ? "Mise en forme IA..." : isRecording ? "Enregistrement en cours..." : "Cliquez pour dicter"}
      </span>
      {onToneChange && (
        <select
          value={tone ?? "neutral"}
          onChange={(e) => onToneChange(e.target.value as VoiceTone)}
          disabled={isRecording || isFormatting}
          style={{
            fontSize: 11, height: 28, borderRadius: 6, border: "1px solid #dce8f0",
            background: "white", color: "#5a6f80", padding: "0 6px", cursor: "pointer",
          }}
        >
          {TONE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}
