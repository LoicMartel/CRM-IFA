"use client";

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
}

const HOUR_HEIGHT = 48;

function timeToY(time: string, dayStartHour: number): number {
  const [h, m] = time.split(":").map(Number);
  return (h - dayStartHour + m / 60) * HOUR_HEIGHT;
}

function isoToY(iso: string, date: string, dayStartHour: number, dayEndHour: number): { top: number; height: number } | null {
  const dt = new Date(iso);
  // Check if this event is on the target date
  const eventDate = dt.toISOString().split("T")[0];
  const targetDate = date;
  // For events that may span midnight, just check overlap
  const h = dt.getHours() + dt.getMinutes() / 60;
  if (eventDate !== targetDate && h > 0) return null;
  return { top: Math.max(0, (h - dayStartHour) * HOUR_HEIGHT), height: 0 };
}

export function DayTimeline({
  date,
  trainers,
  proposals,
  onSelectProposal,
  dayStartHour = 8,
  dayEndHour = 19,
}: DayTimelineProps) {
  const totalHours = dayEndHour - dayStartHour;
  const totalHeight = totalHours * HOUR_HEIGHT;
  const colWidth = trainers.length > 0 ? Math.max(120, Math.min(200, 400 / trainers.length)) : 200;

  const fmtDate = (d: string) => {
    try {
      return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long",
      });
    } catch { return d; }
  };

  // Filter events for this date and compute positions
  function getEventBlocks(events: CalendarEvent[]) {
    const blocks: { top: number; height: number; summary?: string }[] = [];
    for (const ev of events) {
      const startDt = new Date(ev.start);
      const endDt = new Date(ev.end);
      const evDateStr = startDt.toISOString().split("T")[0];

      // Check if event overlaps with the target date
      if (evDateStr !== date) {
        // Could be an all-day event spanning multiple days
        const targetStart = new Date(date + "T00:00:00");
        const targetEnd = new Date(date + "T23:59:59");
        if (startDt > targetEnd || endDt < targetStart) continue;
        // All-day event on this date
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

  // Get proposal blocks for a specific trainer
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

  return (
    <div style={{ userSelect: "none" }}>
      {/* Date header */}
      <div style={{
        fontSize: 13, fontWeight: 700, color: "#1a2a3a", marginBottom: 8,
        textTransform: "capitalize",
      }}>
        {fmtDate(date)}
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

          return (
            <div key={tIdx} style={{
              width: colWidth, flexShrink: 0,
              borderLeft: tIdx > 0 ? "1px solid #dce8f0" : "none",
            }}>
              {/* Trainer name header */}
              <div style={{
                height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#1a6b9c", background: "#f0f7fb",
                borderBottom: "1px solid #dce8f0",
              }}>
                {trainer.name}
              </div>

              {/* Timeline body */}
              <div style={{ position: "relative", height: totalHeight }}>
                {/* Hour grid lines */}
                {Array.from({ length: totalHours }, (_, i) => (
                  <div key={i} style={{
                    position: "absolute", top: i * HOUR_HEIGHT, left: 0, right: 0,
                    height: HOUR_HEIGHT, borderBottom: i < totalHours - 1 ? "1px solid #f0f0f0" : "none",
                  }} />
                ))}

                {/* Busy event blocks */}
                {eventBlocks.map((block, i) => (
                  <div key={`busy-${i}`} style={{
                    position: "absolute", top: block.top, left: 4, right: 4,
                    height: Math.max(block.height, 2), borderRadius: 4,
                    background: "#e8ecf1", border: "1px solid #d0d8e0",
                    overflow: "hidden", zIndex: 1,
                  }}>
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
                    onClick={() => onSelectProposal?.(block.idx)}
                    style={{
                      position: "absolute", top: block.top, left: 4, right: 4,
                      height: Math.max(block.height, 20), borderRadius: 6,
                      background: block.isSelected ? "#e8f5e9" : "rgba(26, 107, 156, 0.08)",
                      border: block.isSelected ? "2px solid #2e7d32" : "2px dashed #1a6b9c",
                      cursor: "pointer", zIndex: 2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: block.isSelected ? "#2e7d32" : "#1a6b9c",
                    }}>
                      {block.time} — {block.duration}h
                    </span>
                  </div>
                ))}
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
