import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { MeetingsView } from "@/components/commercial/meetings-view";

export default async function MeetingsPage() {
  const supabase = await createClient();

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*, contacts(first_name, last_name), companies(name), team_members(first_name, last_name)")
    .order("scheduled_at", { ascending: false });

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, first_name, last_name")
    .eq("is_active", true);

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .order("last_name");

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  const items = meetings ?? [];
  const upcoming = items.filter(m => m.status === "booked");
  const done = items.filter(m => m.status === "done");
  const noShow = items.filter(m => m.status === "no_show");

  const countByType = { R0: 0, R1: 0, R2: 0, R3: 0 };
  items.forEach(m => { if (m.meeting_type in countByType) countByType[m.meeting_type as keyof typeof countByType]++; });

  return (
    <>
      <Header title="RDV Commerciaux" />
      <div className="p-6 space-y-5">
        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
          <div className="lca-card">
            <div style={{ height: 4, background: "#2d7dd2" }} />
            <div style={{ padding: 12 }}>
              <div className="lca-label">Total RDV</div>
              <div className="lca-value">{items.length}</div>
            </div>
          </div>
          <div className="lca-card">
            <div style={{ height: 4, background: "#e8632b" }} />
            <div style={{ padding: 12 }}>
              <div className="lca-label">Planifiés</div>
              <div className="lca-value">{upcoming.length}</div>
            </div>
          </div>
          <div className="lca-card">
            <div style={{ height: 4, background: "#27ae60" }} />
            <div style={{ padding: 12 }}>
              <div className="lca-label">Effectués</div>
              <div className="lca-value">{done.length}</div>
            </div>
          </div>
          <div className="lca-card">
            <div style={{ height: 4, background: "#e74c3c" }} />
            <div style={{ padding: 12 }}>
              <div className="lca-label">No show</div>
              <div className="lca-value">{noShow.length}</div>
            </div>
          </div>
          <div className="lca-card">
            <div style={{ height: 4, background: "#1565c0" }} />
            <div style={{ padding: 12 }}>
              <div className="lca-label">R0 Qualif.</div>
              <div className="lca-value">{countByType.R0}</div>
            </div>
          </div>
          <div className="lca-card">
            <div style={{ height: 4, background: "#e65100" }} />
            <div style={{ padding: 12 }}>
              <div className="lca-label">R1 Découverte</div>
              <div className="lca-value">{countByType.R1}</div>
            </div>
          </div>
          <div className="lca-card">
            <div style={{ height: 4, background: "#6a1b9a" }} />
            <div style={{ padding: 12 }}>
              <div className="lca-label">R2+R3</div>
              <div className="lca-value">{countByType.R2 + countByType.R3}</div>
            </div>
          </div>
        </div>

        <MeetingsView
          meetings={items}
          teamMembers={teamMembers ?? []}
          contacts={contacts ?? []}
          companies={companies ?? []}
        />
      </div>
    </>
  );
}
