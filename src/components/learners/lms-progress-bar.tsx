"use client";

import { useState, useEffect } from "react";
import { GraduationCap, ExternalLink, BookOpen, Clock, Trophy } from "lucide-react";

interface ParcoursProgress {
  parcours_name: string;
  parcours_slug: string;
  status: string;
  completion_pct: number;
  completed_steps: number;
  total_steps: number;
  avg_score: number | null;
  total_time_minutes: number;
  current_step: { number: number; title: string } | null;
}

interface LmsData {
  enrolled: boolean;
  profile_id?: string;
  parcours?: ParcoursProgress[];
}

const LMS_URL = process.env.NEXT_PUBLIC_LMS_URL || "https://lms-lca.vercel.app";

export function LmsProgressBar({ learnerId }: { learnerId: string }) {
  const [data, setData] = useState<LmsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${LMS_URL}/api/progress/by-learner?learner_id=${learnerId}`
        );
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // LMS not reachable
      }
      setLoading(false);
    })();
  }, [learnerId]);

  if (loading || !data || !data.enrolled) {
    return null;
  }

  return (
    <div className="space-y-3">
      {(data.parcours || []).map((p) => (
        <div key={p.parcours_slug} className="lca-card p-0">
          <div className="lca-bar-gradient" />
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: p.completion_pct === 100 ? "#e8f8f0" : "#EFF5F9",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {p.completion_pct === 100 ? (
                    <Trophy size={18} style={{ color: "#2ecc71" }} />
                  ) : (
                    <BookOpen size={18} style={{ color: "#1a6b9c" }} />
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#1a2a3a" }}>
                    LMS — Parcours {p.parcours_name}
                  </p>
                  <div className="flex items-center gap-3" style={{ marginTop: 2 }}>
                    {p.current_step && (
                      <span style={{ fontSize: 11, color: "#FF6B35", fontWeight: 600 }}>
                        Step {p.current_step.number} en cours
                      </span>
                    )}
                    {p.avg_score !== null && (
                      <span style={{ fontSize: 11, color: "#1a6b9c", fontWeight: 600 }}>
                        Score moy. {p.avg_score}%
                      </span>
                    )}
                    {p.total_time_minutes > 0 && (
                      <span className="flex items-center gap-1" style={{ fontSize: 11, color: "#8399a9" }}>
                        <Clock size={10} /> {p.total_time_minutes} min
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p style={{
                  fontSize: 22, fontWeight: 800, lineHeight: 1,
                  color: p.completion_pct >= 80 ? "#2ecc71" : p.completion_pct >= 40 ? "#FF6B35" : "#1a6b9c",
                }}>
                  {p.completion_pct}%
                </p>
                <p style={{ fontSize: 10, color: "#8399a9", marginTop: 2 }}>
                  {p.completed_steps}/{p.total_steps} steps
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="lca-progress-track" style={{ height: 10 }}>
              <div
                className="lca-progress-fill"
                style={{
                  width: `${p.completion_pct}%`,
                  background:
                    p.completion_pct >= 80
                      ? "linear-gradient(90deg, #2ecc71, #27ae60)"
                      : p.completion_pct >= 40
                        ? "linear-gradient(90deg, #FF6B35, #e85d2a)"
                        : "linear-gradient(90deg, #1a6b9c, #0d4f7a)",
                }}
              />
            </div>

            {/* Link to LMS */}
            <div className="flex justify-end mt-2">
              <a
                href={`${LMS_URL}/admin/utilisateurs/${data.profile_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
                style={{ fontSize: 11, color: "#1a6b9c", fontWeight: 600, textDecoration: "none" }}
              >
                Voir sur le LMS <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
