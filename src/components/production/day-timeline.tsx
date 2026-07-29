"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarEvent {
  start: string;
  end: string;
  summary?: string;
}

interface TimelineTrainer {
  name: string;
  events: CalendarEvent[];
}

interface TimelineProposal {
  time: string;
  duration: number;
  trainerName: string;
  isSelected: boolean;
}

interface DayTimelineProps {
  date: string;
  trainers: TimelineTrainer[];
  proposals: TimelineProposal[];
  onSelectProposal?: (index: number) => void;
  dayStartHour?: number;
  dayEndHour?: number;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onClickEmptySlot?: (trainerName: string, time: string) => void;
  sessionDuration?: number;
}

const HOUR_HEIGHT = 48;

function timeToY(time: string, dayStartHour: number): number {
  const [h, m] = time.split(":").map(Number);
  return (h - dayStartHour + m / 60) * HOUR_HEIGHT;
}

export function DayTimeline({
  date,
  trainers,
  proposals,
  onSelectProposal,
  dayStartHour = 8,
  dayEndHour = 19,
  onPrevDay,
  onNextDay,
  canGoPrev = true,
  canGoNext = true,
  onClickEmptySlot,
  sessionDuration,
}: DayTimelineProps) {
  const totalHours = dayEndHour - dayStartHour;
  const totalHeight = totalHours * HOUR_HEIGHT;
  const colWidth = trainers.length > 0 ? Math.max(120, Math.min(200, 400 / trainers.length)) : 200;

  const [hoverSlot, setHoverSlot] = useState<{ trainerIdx: number; time: string } | null>(null);

  const fmtDate = (d: string) => {
    try {
      return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long",
      });
    } catch { return d; }
  };

  function getEventBlocks(events: CalendarEvent[]) {
    const blocks: { top: number; height: number; summary?: string }[] = [];
    for (const ev of events) {
      const startDt = new Date(ev.start);
      const endDt = new Date(ev.end);
      const evDateStr = startDt.toISOString().split("T")[0];

      if (evDateStr !== date) {
        const targetStart = new Date(date + "T00:00:00");
        const targetEnd = new Date(date + "T23:59:59");
        if (startDt > targetEnd || endDt < targetStart) continue;
        blocks.push({ top: 0, height: totalHeight, summary: ev.summary });
        continue;
      }

      const startH = startDt.getHours() + startDt.getMinutes() / 60;
      const endH = endDt.getHours() + endDt.getMinutes() / 60;
      const clampedStart = Math.max(startH, dayStartHour);
      const clampedEnd = Math.min(endH || dayEndHour, dayEndHour);
      if (clampedEnd <= clampedStart) continue;

      blocks.push({
        top: (clampedStart - dayStartHour) * HOUR_HEIGHT,
        height: (clampedEnd - clampedStart) * HOUR_HEIGHT,
        summary: ev.summary,
      });
    }
    return blocks;
  }

  function getProposalBlocks(trainerName: string) {
    return proposals
      .map((p, idx) => ({ ...p, idx }))
      .filter(p => p.trainerName === trainerName)
      .map(p => {
        const top = timeToY(p.time, dayStartHour);
        const height = p.duration * HOUR_HEIGHT;
        return { ...p, top, height };
      });
  }

  function snapToTime(y: number): string | null {
    const hourOffset = y / HOUR_HEIGHT;
    const totalMinutes = (dayStartHour + hourOffset) * 60;
    const snappedMinutes = Math.round(totalMinutes / 30) * 30;
    const hours = Math.floor(snappedMinutes / 60);
    const minutes = snappedMinutes % 60;
    if (hours < dayStartHour || hours >= dayEndHour) return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const showNav = onPrevDay || onNextDay;

  return (
    <div style={{ userSelect: "none" }}>
      {/* Date header with navigation */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 8,
      }}>
        {showNav ? (
          <button
            onClick={onPrevDay}
            disabled={!canGoPrev}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "1px solid #dce8f0",
              background: "white", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: canGoPrev ? "pointer" : "default",
              opacity: canGoPrev ? 1 : 0.3,
            }}
          >
            <ChevronLeft style={{ width: 14, height: 14, color: "#5a6f80" }} />
          </button>
        ) : <div />}

        <div style={{
          fontSize: 13, fontWeight: 700, color: "#1a2a3a",
          textTransform: "capitalize",
        }}>
          {fmtDate(date)}
        </div>

        {showNav ? (
          <button
            onClick={onNextDay}
            disabled={!canGoNext}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "1px solid #dce8f0",
              background: "white", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: canGoNext ? "pointer" : "default",
              opacity: canGoNext ? 1 : 0.3,
            }}
          >
            <ChevronRight style={{ width: 14, height: 14, color: "#5a6f80" }} />
          </button>
        ) : <div />}
      </div>

      <div style={{ display: "flex", gap: 0, overflow: "hidden", borderRadius: 8, border: "1px solid #dce8f0" }}>
        {/* Time axis */}
        <div style={{ width: 44, flexShrink: 0, background: "#f8fbfd", borderRight: "1px solid #dce8f0" }}>
          {Array.from({ length: totalHours }, (_, i) => (
            <div key={i} style={{
              height: HOUR_HEIGHT, display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
              paddingRight: 6, paddingTop: 2, fontSize: 10, color: "#8399a9", fontWeight: 600,
              borderBottom: i < totalHours - 1 ? "1px solid #e8ecf1" : "none",
            }}>
              {dayStartHour + i}h
            </div>
          ))}
        </div>

        {/* Trainer columns */}
        {trainers.map((trainer, tIdx) => {
          const eventBlocks = getEventBlocks(trainer.events);
          const proposalBlocks = getProposalBlocks(trainer.name);
          const hoverForThisTrainer = hoverSlot?.trainerIdx === tIdx ? hoverSlot : null;

          return (
            <div key={tIdx} style={{
              width: colWidth, flexShrink: 0,
              borderLeft: tIdx > 0 ? "1px solid #dce8f0" : "none",
            }}>
              {/* Trainer name header */}
              <div style={{
                height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#1E2A5A", background: "#f0f7fb",
                borderBottom: "1px solid #dce8f0",
              }}>
                {trainer.name}
              </div>

              {/* Timeline body */}
              <div
                style={{
                  position: "relative", height: totalHeight,
                  cursor: onClickEmptySlot ? "crosshair" : "default",
                }}
                onClick={(e) => {
                  if (!onClickEmptySlot) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const time = snapToTime(y);
                  if (time) onClickEmptySlot(trainer.name, time);
                }}
                onMouseMove={(e) => {
                  if (!onClickEmptySlot) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const time = snapToTime(y);
                  if (time) {
                    setHoverSlot({ trainerIdx: tIdx, time });
                  } else {
                    setHoverSlot(null);
                  }
                }}
                onMouseLeave={() => setHoverSlot(null)}
              >
                {/* Hour grid lines */}
                {Array.from({ length: totalHours }, (_, i) => (
                  <div key={i} style={{
                    position: "absolute", top: i * HOUR_HEIGHT, left: 0, right: 0,
                    height: HOUR_HEIGHT, borderBottom: i < totalHours - 1 ? "1px solid #f0f0f0" : "none",
                  }} />
                ))}

                {/* Busy event blocks */}
                {eventBlocks.map((block, i) => (
                  <div
                    key={`busy-${i}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute", top: block.top, left: 4, right: 4,
                      height: Math.max(block.height, 2), borderRadius: 4,
                      background: "#e8ecf1", border: "1px solid #d0d8e0",
                      overflow: "hidden", zIndex: 1,
                    }}
                  >
                    {block.height >= 20 && block.summary && (
                      <div style={{
                        fontSize: 9, color: "#5a6f80", padding: "2px 4px",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {block.summary}
                      </div>
                    )}
                  </div>
                ))}

                {/* Proposal blocks */}
                {proposalBlocks.map((block) => (
                  <div
                    key={`prop-${block.idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProposal?.(block.idx);
                    }}
                    style={{
                      position: "absolute", top: block.top, left: 4, right: 4,
                      height: Math.max(block.height, 20), borderRadius: 6,
                      background: block.isSelected ? "#e8f5e9" : "rgba(26, 107, 156, 0.08)",
                      border: block.isSelected ? "2px solid #2e7d32" : "2px dashed #1E2A5A",
                      cursor: "pointer", zIndex: 2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: block.isSelected ? "#2e7d32" : "#1E2A5A",
                    }}>
                      {block.time} — {block.duration}h
                    </span>
                  </div>
                ))}

                {/* Hover preview */}
                {hoverForThisTrainer && sessionDuration && (
                  <div
                    style={{
                      position: "absolute",
                      top: timeToY(hoverForThisTrainer.time, dayStartHour),
                      left: 4, right: 4,
                      height: sessionDuration * HOUR_HEIGHT,
                      borderRadius: 6,
                      background: "rgba(26, 107, 156, 0.06)",
                      border: "1px dashed rgba(26, 107, 156, 0.3)",
                      pointerEvents: "none",
                      zIndex: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: 9, color: "rgba(26, 107, 156, 0.5)", fontWeight: 600 }}>
                      {hoverForThisTrainer.time}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {trainers.length === 0 && (
          <div style={{
            flex: 1, height: totalHeight, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "#8399a9",
          }}>
            Aucun calendrier disponible
          </div>
        )}
      </div>
    </div>
  );
}
