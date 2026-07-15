"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, PhoneCall, X } from "lucide-react";
import { formatPhone } from "@/lib/utils";
import { ActivityModal } from "@/components/commercial/activity-modal";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
  lead_status: string | null;
  lifecycle_stage: string | null;
  created_at: string;
  last_contacted_at: string | null;
  owner_id: string | null;
  companies: { name: string }[] | { name: string } | null;
  lead_sources: { name: string }[] | { name: string } | null;
  team_members: { id: string; first_name: string; last_name: string }[] | { id: string; first_name: string; last_name: string } | null;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
}

interface Activity {
  contact_id: string;
  type: string;
  description: string | null;
  created_at: string;
  team_member_id: string | null;
  team_members: TeamMember | TeamMember[] | null;
}

type SettingColumn = "new" | "not_reached" | "contacted_not_booked" | "booked";

const COLUMNS: { key: SettingColumn; label: string; color: string; bg: string; bar: string }[] = [
  { key: "new", label: "New Leads", color: "#1565c0", bg: "#e3f2fd", bar: "#1565c0" },
  { key: "not_reached", label: "Not Reached", color: "#e65100", bg: "#fff3e0", bar: "#e65100" },
  { key: "contacted_not_booked", label: "Contacted Not Booked", color: "#6a1b9a", bg: "#f3e5f5", bar: "#6a1b9a" },
  { key: "booked", label: "Booked", color: "#2e7d32", bg: "#e8f5e9", bar: "#2e7d32" },
];

function getName(rel: { name: string }[] | { name: string } | null): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return rel.name;
}

function getOwnerName(lead: Lead): string | null {
  const tm = lead.team_members;
  if (!tm) return null;
  const m = Array.isArray(tm) ? tm[0] : tm;
  return m ? `${m.first_name} ${m.last_name}` : null;
}

/** Returns true if lead hasn't been contacted in the last 48 hours */
function isStale48h(lead: Lead): boolean {
  const refStr = lead.last_contacted_at || lead.created_at;
  return Date.now() - new Date(refStr).getTime() > 48 * 60 * 60 * 1000;
}

function classifyLead(
  lead: Lead,
  activitiesByContact: Map<string, Activity[]>,
): SettingColumn {
  const acts = activitiesByContact.get(lead.id);

  // No activities at all → New Lead
  if (!acts || acts.length === 0) return "new";

  // Check call activities for results
  // Call results are encoded in the description by handleLogActivity:
  // "Pas de réponse", "Message vocal laissé", "Contacté → Non booké", "Contacté → Booké", "Pas intéressé"
  let hasNotReached = false;
  let hasContactedNotBooked = false;
  let hasBooked = false;

  for (const a of acts) {
    const desc = a.description ?? "";
    if (desc.startsWith("Contacté → Booké") || desc.startsWith("Contacté → Booké")) {
      hasBooked = true;
    } else if (desc.startsWith("Contacté → Non booké") || desc.startsWith("Contacté → Non booké")) {
      hasContactedNotBooked = true;
    } else if (desc.startsWith("Pas de réponse") || desc.startsWith("Message vocal laissé")) {
      hasNotReached = true;
    }
  }

  // Priority: booked > contacted_not_booked > not_reached > new
  if (hasBooked) return "booked";
  if (hasContactedNotBooked) return "contacted_not_booked";
  if (hasNotReached) return "not_reached";

  // Fallback: use lead_status directly (e.g. booked via booking page, not via activity modal)
  if (lead.lead_status === "booked") return "booked";
  if (lead.lead_status === "contacted") return "contacted_not_booked";

  // Has activities but no call results → still consider as "new" since no call was made
  return "new";
}

/** Returns the name of the team member who performed the most recent activity on this lead */
function getCallerName(lead: Lead, activitiesByContact: Map<string, Activity[]>): string | null {
  const acts = activitiesByContact.get(lead.id);
  if (!acts) return null;
  // Find the most recent activity with a team member (activities are already sorted desc)
  for (const a of acts) {
    const tm = a.team_members;
    if (!tm) continue;
    const m = Array.isArray(tm) ? tm[0] : tm;
    if (m) return `${m.first_name} ${m.last_name}`;
  }
  return null;
}

export function SettingBoard({
  leads,
  activities,
  teamMembers,
}: {
  leads: Lead[];
  activities: Activity[];
  teamMembers: TeamMember[];
}) {
  const [activityLeadId, setActivityLeadId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState("");
  const [filterType, setFilterType] = useState("");

  // Group activities by contact
  const activitiesByContact = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of activities) {
      const list = map.get(a.contact_id);
      if (list) list.push(a);
      else map.set(a.contact_id, [a]);
    }
    return map;
  }, [activities]);

  const ownerNames = useMemo(() => {
    return teamMembers.map((m) => `${m.first_name} ${m.last_name}`).sort();
  }, [teamMembers]);

  // Classify leads into columns
  const columnLeads = useMemo(() => {
    const result: Record<SettingColumn, Lead[]> = {
      new: [],
      not_reached: [],
      contacted_not_booked: [],
      booked: [],
    };

    let filtered = leads;
    if (filterOwner) filtered = filtered.filter((l) => {
      const caller = getCallerName(l, activitiesByContact);
      const owner = getOwnerName(l);
      return caller === filterOwner || owner === filterOwner;
    });
    if (filterType) filtered = filtered.filter((l) => getName(l.lead_sources) === filterType);

    for (const lead of filtered) {
      const col = classifyLead(lead, activitiesByContact);
      result[col].push(lead);
    }

    // Sort: +48h leads first (most recent to oldest), then non-warning leads (most recent to oldest)
    for (const key of Object.keys(result) as SettingColumn[]) {
      result[key].sort((a, b) => {
        if (key === "new" || key === "not_reached") {
          const aStale = isStale48h(a);
          const bStale = isStale48h(b);
          if (aStale && !bStale) return -1;
          if (!aStale && bStale) return 1;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return result;
  }, [leads, activitiesByContact, filterOwner, filterType]);

  const totalLeads = Object.values(columnLeads).reduce((s, arr) => s + arr.length, 0);

  return (
    <>
      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-5">
        <div className="lca-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total leads</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{totalLeads}</div>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.key} className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>{col.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: col.color }}>{columnLeads[col.key].length}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
        >
          <option value="">Tous les Account Managers</option>
          {ownerNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">Tous les types</option>
          <option value="Meta ads - tunnel book">Tunnel Book</option>
          <option value="Meta ads - tunnel commercial">Tunnel Commercial</option>
        </select>
      </div>

      {/* Kanban Board */}
      <div style={{ display: "flex", gap: 12, minHeight: 400, overflowX: "auto", paddingBottom: 8 }}>
        {COLUMNS.map((col) => {
          const leadsInCol = columnLeads[col.key];
          return (
            <div
              key={col.key}
              style={{
                background: "#f5f7fa",
                borderRadius: 8,
                padding: 12,
                border: "2px solid transparent",
                minWidth: 240,
                flex: "1 0 240px",
              }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <span style={{ background: col.bg, color: col.color, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                  {col.label}
                </span>
                <span style={{ fontSize: 11, color: "#7a8bab", fontWeight: 600 }}>{leadsInCol.length}</span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {leadsInCol.map((lead) => {
                  const showWarning = (col.key === "new" || col.key === "not_reached") && isStale48h(lead);
                  return (
                    <div
                      key={lead.id}
                      className="lca-card"
                      onClick={() => setSelectedLeadId(lead.id)}
                      style={{
                        padding: "8px 10px",
                        borderLeft: `3px solid ${col.bar}`,
                        position: "relative",
                        cursor: "pointer",
                      }}
                    >
                      {/* 48h Warning */}
                      {showWarning && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 4,
                          background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 4,
                          padding: "2px 6px", marginBottom: 6, width: "fit-content",
                        }}>
                          <AlertTriangle style={{ width: 11, height: 11, color: "#e67e00" }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#e67e00" }}>+48h</span>
                        </div>
                      )}

                      {/* Action button (top right) */}
                      <div style={{ position: "absolute", top: showWarning ? 30 : 4, right: 4 }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setActivityLeadId(lead.id); }}
                          title="Nouvelle activité"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 2,
                            padding: "2px 6px", borderRadius: 4, border: "1px solid #dce8f0",
                            background: "white", color: "#1a6b9c", fontSize: 10, fontWeight: 600,
                            cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          <PhoneCall style={{ width: 10, height: 10 }} />
                          Actions
                        </button>
                      </div>

                      {/* Lead info */}
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1b2a4a", paddingRight: 55, lineHeight: 1.3 }}>
                        {lead.first_name} {lead.last_name}
                      </div>
                      {getName(lead.companies) && (
                        <div style={{ fontSize: 10, color: "#1a6b9c", marginTop: 1 }}>
                          {getName(lead.companies)}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: "#5a6f80", marginTop: 3 }}>
                        {lead.phone ? formatPhone(lead.phone) : lead.email ?? "—"}
                      </div>
                      <div className="flex items-center justify-between" style={{ marginTop: 3 }}>
                        <span style={{ fontSize: 9, color: "#8399a9" }}>
                          {getName(lead.lead_sources) ?? "—"}
                        </span>
                        <span style={{ fontSize: 9, color: "#8399a9" }}>
                          {new Date(lead.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {leadsInCol.length === 0 && (
                  <div style={{ fontSize: 12, color: "#aab5cc", textAlign: "center", padding: 20 }}>
                    Aucun lead
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lead Detail Popup */}
      {selectedLeadId && (() => {
        const lead = leads.find((l) => l.id === selectedLeadId);
        if (!lead) return null;
        const leadCol = classifyLead(lead, activitiesByContact);
        const stale = (leadCol === "new" || leadCol === "not_reached") && isStale48h(lead);
        const acts = activitiesByContact.get(lead.id);
        const lastAct = acts?.[0] ?? null;
        // Extract issue from last activity description
        let lastIssue = "—";
        if (lastAct?.description) {
          const desc = lastAct.description;
          if (desc.startsWith("Contacté → Booké")) lastIssue = "Contacté → Booké";
          else if (desc.startsWith("Contacté → Non booké")) lastIssue = "Contacté → Non booké";
          else if (desc.startsWith("Pas de réponse")) lastIssue = "Pas de réponse";
          else if (desc.startsWith("Message vocal laissé")) lastIssue = "Message vocal laissé";
          else if (desc.startsWith("Pas intéressé")) lastIssue = "Pas intéressé";
          else if (desc.startsWith("Contacté")) lastIssue = "Contacté";
        }

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setSelectedLeadId(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: "white", borderRadius: 12, padding: "24px 28px", maxWidth: 420, width: "90%", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedLeadId(null)}
                style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "#8399a9" }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>

              {/* 48h Warning */}
              {stale && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6,
                  padding: "8px 12px", marginBottom: 16,
                }}>
                  <AlertTriangle style={{ width: 16, height: 16, color: "#e67e00", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e67e00" }}>N&apos;a pas été appelé depuis +48h!</span>
                </div>
              )}

              {/* Name (clickable → contact page) */}
              <Link
                href={`/contacts/${lead.id}?from=setting`}
                style={{ fontSize: 18, fontWeight: 700, color: "#1a6b9c", textDecoration: "underline", textUnderlineOffset: 2 }}
              >
                {lead.first_name} {lead.last_name}
              </Link>

              {/* Info grid */}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {getName(lead.companies) && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9", letterSpacing: "0.05em" }}>Entreprise</div>
                    <div style={{ fontSize: 14, color: "#1b2a4a" }}>{getName(lead.companies)}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9", letterSpacing: "0.05em" }}>Téléphone</div>
                  <div style={{ fontSize: 14, color: "#1b2a4a" }}>{lead.phone ? formatPhone(lead.phone) : "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9", letterSpacing: "0.05em" }}>Email</div>
                  <div style={{ fontSize: 14, color: "#1b2a4a" }}>{lead.email ?? "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9", letterSpacing: "0.05em" }}>Dernière action</div>
                  <div style={{ fontSize: 14, color: "#1b2a4a" }}>
                    {lastAct
                      ? `${new Date(lastAct.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} — ${lastIssue}`
                      : "Aucune action"
                    }
                  </div>
                </div>
              </div>

              {/* Actions button */}
              <button
                type="button"
                onClick={() => { setSelectedLeadId(null); setActivityLeadId(lead.id); }}
                style={{
                  marginTop: 20, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 0", borderRadius: 8, border: "none",
                  background: "#FF6B35", color: "white", fontSize: 14, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <PhoneCall style={{ width: 15, height: 15 }} />
                Nouvelle activité
              </button>
            </div>
          </div>
        );
      })()}

      {/* Activity Modal */}
      {activityLeadId && (() => {
        const lead = leads.find((l) => l.id === activityLeadId);
        if (!lead) return null;
        return (
          <ActivityModal
            contactId={lead.id}
            companyId={lead.company_id}
            contactName={`${lead.first_name} ${lead.last_name}`}
            open={true}
            onOpenChange={(open) => { if (!open) setActivityLeadId(null); }}
          />
        );
      })()}
    </>
  );
}
