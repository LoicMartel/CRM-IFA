"use client";

import { useState, useRef, useCallback } from "react";
import type { VoiceTone } from "@/components/ui/voice-button";

export function useVoiceDictation(
  getValue: () => string,
  setValue: (text: string) => void,
  options?: { names?: string[] },
) {
  const [isRecording, setIsRecording] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [tone, setTone] = useState<VoiceTone>("neutral");
  const recognitionRef = useRef<any>(null);
  const rawPartsRef = useRef<string[]>([]);
  const baseTextRef = useRef("");
  const toneRef = useRef<VoiceTone>("neutral");

  const updateTone = useCallback((t: VoiceTone) => {
    setTone(t);
    toneRef.current = t;
  }, []);

  const namesRef = useRef<string[]>(options?.names ?? []);
  namesRef.current = options?.names ?? [];

  const formatWithAI = useCallback(async (rawText: string, existingText: string) => {
    setIsFormatting(true);
    try {
      const res = await fetch("/api/voice/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, existingText, tone: toneRef.current, names: namesRef.current.length > 0 ? namesRef.current : undefined }),
      });
      const data = await res.json();
      if (data.formatted) {
        setValue(existingText ? existingText.trimEnd() + "\n" + data.formatted : data.formatted);
      }
    } catch {
      const cleaned = rawText.charAt(0).toUpperCase() + rawText.slice(1);
      setValue(existingText ? existingText.trimEnd() + "\n" + cleaned : cleaned);
    }
    setIsFormatting(false);
  }, [setValue]);

  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Reconnaissance vocale non supportée par ce navigateur."); return; }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;

    baseTextRef.current = getValue();
    rawPartsRef.current = [];

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          rawPartsRef.current.push(transcript.trim());
        } else {
          interim = transcript;
        }
      }
      const rawSoFar = rawPartsRef.current.join(" ") + (interim ? " " + interim : "");
      const prefix = baseTextRef.current ? baseTextRef.current.trimEnd() + "\n" : "";
      setValue(prefix + rawSoFar);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      const rawText = rawPartsRef.current.join(" ").trim();
      if (rawText) {
        formatWithAI(rawText, baseTextRef.current);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }, [getValue, setValue, formatWithAI]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording(); else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  return { isRecording, isFormatting, tone, setTone: updateTone, startRecording, stopRecording, toggleRecording };
}
