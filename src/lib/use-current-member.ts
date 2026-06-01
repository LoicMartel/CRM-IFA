"use client";

import { useState, useEffect } from "react";
import { getCurrentMember } from "@/lib/current-member";

export function useCurrentMember() {
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getCurrentMember()
      .then((m) => { if (active) setMemberId(m?.id ?? null); })
      .catch(() => { /* transient failure: leave state unset, next mount retries */ });

    return () => {
      active = false;
    };
  }, []);

  return memberId;
}
