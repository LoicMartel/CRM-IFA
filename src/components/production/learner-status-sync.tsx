"use client";

import { useEffect } from "react";

export function LearnerStatusSync() {
  useEffect(() => {
    // Only sync once per day
    const key = `learner-status-sync-${new Date().toISOString().split("T")[0]}`;
    if (typeof window !== "undefined" && !localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      fetch("/api/learners/sync-status").catch(() => {});
    }
  }, []);

  return null;
}
