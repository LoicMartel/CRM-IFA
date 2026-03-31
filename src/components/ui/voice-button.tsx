"use client";

import { Mic, MicOff } from "lucide-react";

export function VoiceButton({ isRecording, onClick }: { isRecording: boolean; onClick: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          height: 36, width: 36, borderRadius: "50%", border: "none", cursor: "pointer",
          background: isRecording ? "#e74c3c" : "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
          color: "white", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isRecording ? "0 0 0 4px rgba(231,76,60,0.2)" : "none",
          animation: isRecording ? "pulse 1.5s infinite" : "none",
          flexShrink: 0,
        }}
      >
        {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
      <span style={{ fontSize: 12, color: isRecording ? "#e74c3c" : "#8399a9", fontWeight: isRecording ? 600 : 400 }}>
        {isRecording ? "Enregistrement en cours..." : "Cliquez pour dicter"}
      </span>
    </div>
  );
}
