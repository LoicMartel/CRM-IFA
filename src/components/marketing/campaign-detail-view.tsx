"use client";

import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Eye, MousePointerClick, AlertTriangle, Mail, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  from_name: string;
  from_email: string;
  html_content: string;
  status: string;
  sent_at: string | null;
  sent_count: number;
  contact_lists: { name: string } | null;
}

interface Recipient {
  id: string;
  email: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  contacts: { first_name: string; last_name: string } | null;
}

const recipientStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "#f0f0f0", text: "#666", label: "En attente" },
  sent: { bg: "#e3f2fd", text: "#1565c0", label: "Envoyé" },
  delivered: { bg: "#e8f5e9", text: "#2e7d32", label: "Remis" },
  opened: { bg: "#fff3e0", text: "#e65100", label: "Ouvert" },
  clicked: { bg: "#f3e5f5", text: "#6a1b9a", label: "Cliqué" },
  bounced: { bg: "#fce4ec", text: "#c62828", label: "Rejeté" },
  complained: { bg: "#fce4ec", text: "#c62828", label: "Plainte" },
  unsubscribed: { bg: "#f0f0f0", text: "#666", label: "Désabonné" },
};

function fmtPct(n: number, d: number) {
  if (d === 0) return "0 %";
  return ((n / d) * 100).toFixed(1) + " %";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
}

export function CampaignDetailView({
  campaign,
  recipients,
}: {
  campaign: Campaign;
  recipients: Recipient[];
}) {
  const router = useRouter();

  const total = recipients.length;
  const delivered = recipients.filter((r) => ["delivered", "opened", "clicked"].includes(r.status)).length;
  const opened = recipients.filter((r) => ["opened", "clicked"].includes(r.status)).length;
  const clicked = recipients.filter((r) => r.status === "clicked").length;
  const bounced = recipients.filter((r) => ["bounced", "complained"].includes(r.status)).length;

  return (
    <>
      {/* Back + Campaign info */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/marketing/campagnes")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <div>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{
            backgroundColor: campaign.status === "sent" ? "#e8f5e9" : "#f0f0f0",
            color: campaign.status === "sent" ? "#2e7d32" : "#666",
          }}>
            {campaign.status === "sent" ? "Envoyée" : campaign.status === "sending" ? "Envoi en cours..." : "Brouillon"}
          </span>
        </div>
      </div>

      {/* Campaign details */}
      <div className="lca-card" style={{ padding: 20 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ fontSize: 13 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9" }}>Objet</div>
            <div style={{ fontWeight: 600, color: "#1a2a3a" }}>{campaign.subject}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9" }}>Expéditeur</div>
            <div style={{ color: "#5a6f80" }}>{campaign.from_name} &lt;{campaign.from_email}&gt;</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9" }}>Liste</div>
            <div style={{ color: "#5a6f80" }}>{campaign.contact_lists?.name ?? "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9" }}>Date d'envoi</div>
            <div style={{ color: "#5a6f80" }}>{fmtDate(campaign.sent_at)}</div>
          </div>
        </div>
      </div>

      {/* Stats KPIs */}
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a6b9c" }}>
        Envoyé à {total}, remis à {delivered}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="lca-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9", marginBottom: 4 }}>Taux d'ouverture</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#27ae60" }}>{fmtPct(opened, total)}</div>
          <div style={{ fontSize: 11, color: "#8399a9", marginTop: 4 }}>Ouvertures uniques : {opened}</div>
        </div>
        <div className="lca-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9", marginBottom: 4 }}>Taux de clic</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#e65100" }}>{fmtPct(clicked, total)}</div>
          <div style={{ fontSize: 11, color: "#8399a9", marginTop: 4 }}>Clics uniques : {clicked}</div>
        </div>
        <div className="lca-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9", marginBottom: 4 }}>Taux clics/ouvertures</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#6a1b9a" }}>{fmtPct(clicked, opened)}</div>
        </div>
        <div className="lca-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8399a9", marginBottom: 4 }}>Rejetés</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: bounced > 0 ? "#e74c3c" : "#27ae60" }}>{bounced}</div>
          <div style={{ fontSize: 11, color: "#8399a9", marginTop: 4 }}>{fmtPct(bounced, total)} du total</div>
        </div>
      </div>

      {/* Recipients table */}
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>
        Destinataires ({total})
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinataire</TableHead>
              <TableHead>Email</TableHead>
              <TableHead style={{ textAlign: "center" }}>Statut</TableHead>
              <TableHead>Envoyé</TableHead>
              <TableHead>Remis</TableHead>
              <TableHead>Ouvert</TableHead>
              <TableHead>Cliqué</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Aucun destinataire
                </TableCell>
              </TableRow>
            ) : (
              recipients.map((r) => {
                const sc = recipientStatusColors[r.status] ?? recipientStatusColors.pending;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.contacts ? `${r.contacts.first_name} ${r.contacts.last_name}` : "—"}
                    </TableCell>
                    <TableCell style={{ color: "#5a6f80", fontSize: 13 }}>{r.email}</TableCell>
                    <TableCell style={{ textAlign: "center" }}>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                        {sc.label}
                      </span>
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: "#8399a9" }}>{fmtDate(r.sent_at)}</TableCell>
                    <TableCell style={{ fontSize: 12, color: "#8399a9" }}>{fmtDate(r.delivered_at)}</TableCell>
                    <TableCell style={{ fontSize: 12, color: "#8399a9" }}>{fmtDate(r.opened_at)}</TableCell>
                    <TableCell style={{ fontSize: 12, color: "#8399a9" }}>{fmtDate(r.clicked_at)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
