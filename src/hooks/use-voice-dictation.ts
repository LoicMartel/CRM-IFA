"use client";

import { useState, useRef, useCallback } from "react";

function autoPunctuate(text: string): string {
  let r = text;
  r = r.charAt(0).toUpperCase() + r.slice(1);
  r = r.replace(/\s*virgule\s*/gi, ", ");
  r = r.replace(/\s*point d'exclamation\s*/gi, "! ");
  r = r.replace(/\s*point d'interrogation\s*/gi, "? ");
  r = r.replace(/\s*point\s*$/gi, ".");
  r = r.replace(/\s*point\s+/gi, ". ");
  r = r.replace(/\s*deux[ -]points\s*/gi, " : ");
  r = r.replace(/\s*point-virgule\s*/gi, " ; ");
  r = r.replace(/\s*tiret\s*/gi, " - ");
  r = r.replace(/\s*retour [àa] la ligne\s*/gi, "\n");
  r = r.replace(/\s*aller [àa] la ligne\s*/gi, "\n");
  r = r.replace(/\s*nouvelle ligne\s*/gi, "\n");
  r = r.replace(/\s*saut de ligne\s*/gi, "\n");
  r = r.replace(/\s*[àa] la ligne\s*/gi, "\n");
  r = r.replace(/([.!?]\s+|[\n])(\w)/g, (_, p, c) => p + c.toUpperCase());
  r = r.replace(/ {2,}/g, " ");
  return r.trim();
}

export function useVoiceDictation(
  getValue: () => string,
  setValue: (text: string) => void,
) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Reconnaissance vocale non supportée."); return; }
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    finalTranscriptRef.current = getValue();
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const punctuated = autoPunctuate(transcript);
          if (punctuated.startsWith("\n")) {
            finalTranscriptRef.current = finalTranscriptRef.current.trimEnd() + punctuated;
          } else {
            if (finalTranscriptRef.current && !/[.!?:;\n]\s*$/.test(finalTranscriptRef.current)) finalTranscriptRef.current += ". ";
            else if (finalTranscriptRef.current && !/[\s\n]$/.test(finalTranscriptRef.current)) finalTranscriptRef.current += " ";
            finalTranscriptRef.current += punctuated;
          }
        } else {
          interim = transcript;
        }
      }
      setValue(finalTranscriptRef.current + (interim ? " " + interim : ""));
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }, [getValue, setValue]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording(); else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  return { isRecording, startRecording, stopRecording, toggleRecording };
}
