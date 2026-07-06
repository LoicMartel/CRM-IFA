"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentMember } from "@/lib/use-current-member";
import { activityTypeLabels } from "@/lib/activity-display";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";

interface ActivityFormState {
  type: string;
  title: string;
  description: string;
  due_date: string;
  call_result: string;
  call_outcome: string;
  rdv_date: string;
  task_deadline: string;
}

const INITIAL_FORM: ActivityFormState = {
  type: "appel",
  title: "",
  description: "",
  due_date: "",
  call_result: "",
  call_outcome: "",
  rdv_date: "",
  task_deadline: "",
};

export function ActivityModal({
  contactId,
  companyId,
  contactName,
  open,
  onOpenChange,
}: {
  contactId: string;
  companyId: string | null;
  contactName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const currentMemberId = useCurrentMember();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ActivityFormState>({ ...INITIAL_FORM });

  const voice = useVoiceDictation(
    () => form.description,
    (text) => setForm((f) => ({ ...f, description: text })),
  );

  function handleClose(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) {
      setForm({ ...INITIAL_FORM });
    }
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    // Build description with call result if applicable
    let fullDescription = form.description || "";
    if (form.type === "appel" && form.call_result) {
      const resultLabels: Record<string, string> = {
        no_answer: "Pas de réponse",
        voicemail: "Message vocal laissé",
        contacted: "Contacté",
        not_interested: "Pas intéressé",
      };
      const outcomeLabels: Record<string, string> = {
        not_booked: "Non booké",
        booked: "Booké",
        non_qualifie: "Non qualifié",
      };
      let resultText = resultLabels[form.call_result] || "";
      if (form.call_result === "contacted" && form.call_outcome) {
        resultText += " → " + (outcomeLabels[form.call_outcome] || "");
      }
      fullDescription = resultText + (fullDescription ? "\n" + fullDescription : "");
    }

    const payload: Record<string, any> = {
      type: form.type,
      title: form.title,
      description: fullDescription || null,
      due_date: form.due_date || null,
      task_deadline: form.type === "tâche" && form.task_deadline ? form.task_deadline : null,
      contact_id: contactId,
      company_id: companyId || null,
      team_member_id: currentMemberId || null,
    };

    const { data: newActivity } = await supabase
      .from("activities")
      .insert(payload)
      .select("id")
      .single();

    // Sync task to Google Calendar
    const hasTaskDate = form.due_date || (form.type === "tâche" && form.task_deadline);
    if (newActivity?.id && form.type === "tâche" && hasTaskDate) {
      try {
        const notifyRes = await fetch("/api/tasks/sync-gcal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: newActivity.id }),
        });
        const notifyData = await notifyRes.json();
        if (notifyData.result) {
          alert(`Tâche créée ✅\n\nGoogle Calendar: ${notifyData.result}`);
        }
      } catch {}
    }

    // Update contact lead_status based on call result
    if (form.type === "appel") {
      if (form.call_result === "not_interested") {
        await supabase
          .from("contacts")
          .update({
            last_contacted_at: new Date().toISOString(),
            lead_status: "not_interested",
            lifecycle_stage: "prospect",
          })
          .eq("id", contactId);
      } else if (form.call_result === "contacted") {
        const callUpdate: Record<string, string> = {
          last_contacted_at: new Date().toISOString(),
          lead_status: form.call_outcome === "booked" ? "booked" : "contacted",
        };
        if (form.call_outcome === "booked") {
          callUpdate.lifecycle_stage = "prospect";
        }
        await supabase.from("contacts").update(callUpdate).eq("id", contactId);
      } else {
        await supabase
          .from("contacts")
          .update({ last_contacted_at: new Date().toISOString() })
          .eq("id", contactId);
      }
    } else {
      await supabase
        .from("contacts")
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("id", contactId);
    }

    const shouldOpenRdv =
      form.type === "appel" &&
      form.call_result === "contacted" &&
      form.call_outcome === "booked";

    setSaving(false);
    handleClose(false);

    if (shouldOpenRdv) {
      // Redirect to contact detail to create the RDV
      router.push(`/contacts/${contactId}?from=leads&openRdv=1`);
    } else {
      router.refresh();
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nouvelle activité</SheetTitle>
          <p style={{ fontSize: 13, color: "#8399a9", margin: 0 }}>{contactName}</p>
        </SheetHeader>
        <div className="space-y-4 mt-6 px-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {Object.entries(activityTypeLabels).map(([key, val]) => (
                <option key={key} value={key}>
                  {val}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Date &amp; Heure de l&apos;action</Label>
            <Input
              type="datetime-local"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>

          {/* Task deadline - only for "tâche" type */}
          {form.type === "tâche" && (
            <div className="space-y-2">
              <Label>Échéance de la tâche</Label>
              <Input
                type="date"
                value={form.task_deadline}
                onChange={(e) => setForm({ ...form, task_deadline: e.target.value })}
              />
            </div>
          )}

          {/* Call result fields - only for "appel" type */}
          {form.type === "appel" && (
            <div className="space-y-2">
              <Label>Résultat de l&apos;appel</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.call_result}
                onChange={(e) =>
                  setForm({ ...form, call_result: e.target.value, call_outcome: "" })
                }
              >
                <option value="">Sélectionner...</option>
                <option value="no_answer">Pas de réponse</option>
                <option value="voicemail">Message vocal laissé</option>
                <option value="contacted">Contacté</option>
                <option value="not_interested">Pas intéressé</option>
              </select>
            </div>
          )}

          {form.type === "appel" && form.call_result === "contacted" && (
            <div className="space-y-2">
              <Label>Issue</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.call_outcome}
                onChange={(e) => setForm({ ...form, call_outcome: e.target.value })}
              >
                <option value="">Sélectionner...</option>
                <option value="not_booked">Not booked</option>
                <option value="booked">Booked</option>
                <option value="non_qualifie">Non qualifié</option>
              </select>
            </div>
          )}

          {form.type === "appel" &&
            form.call_result === "contacted" &&
            form.call_outcome === "booked" && (
              <>
                <div className="space-y-2">
                  <Label>Date &amp; Heure du RDV planifié</Label>
                  <Input
                    type="datetime-local"
                    value={form.rdv_date ?? ""}
                    onChange={(e) => setForm({ ...form, rdv_date: e.target.value })}
                  />
                </div>
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#e8f8f0",
                    borderRadius: 8,
                    borderLeft: "4px solid #2ecc71",
                    fontSize: 13,
                    color: "#27ae60",
                    fontWeight: 500,
                  }}
                >
                  Après enregistrement, vous serez redirigé vers la fiche contact pour créer le RDV.
                </div>
              </>
            )}

          <div className="space-y-2">
            <Label>Description</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <VoiceButton
              isRecording={voice.isRecording}
              isFormatting={voice.isFormatting}
              onClick={voice.toggleRecording}
              tone={voice.tone}
              onToneChange={voice.setTone}
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="w-full"
            style={{ background: "#FF6B35", color: "white" }}
          >
            {saving ? "Enregistrement..." : "Enregistrer l'activité"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
