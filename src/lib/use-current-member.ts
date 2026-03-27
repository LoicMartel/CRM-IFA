"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCurrentMember() {
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try by auth_user_id first
      const { data: member } = await supabase
        .from("team_members")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (member) {
        setMemberId(member.id);
        return;
      }

      // Fallback: match by email
      const { data: memberByEmail } = await supabase
        .from("team_members")
        .select("id")
        .eq("email", user.email)
        .single();

      if (memberByEmail) {
        setMemberId(memberByEmail.id);
      }
    }
    load();
  }, []);

  return memberId;
}
