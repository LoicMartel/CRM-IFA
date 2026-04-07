"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { VoiceButton } from "@/components/ui/voice-button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type {
  LeadWithRelations,
  SalesMember,
  CompanyTypeOption,
  LeadSourceOption,
} from "@/types/leads";
import type { LeadStepStatus, LeadStatus } from "@/types/database";

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadWithRelations | null;
  salesMembers: SalesMember[];
  companyTypes: CompanyTypeOption[];
  leadSources: LeadSourceOption[];
}

const STEP_STATUS_OPTIONS: { value: LeadStepStatus; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "done", label: "Fait" },
  { value: "skipped", label: "Sauté" },
];

const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "nouveau", label: "Nouveau" },
  { value: "en_cours", label: "En cours" },
  { value: "r_plus_booked", label: "R+ Booké" },
  { value: "gagné", label: "Gagné" },
  { value: "perdu", label: "Perdu" },
];

interface FormState {
  contactFirstName: string;
  contactLastName: string;
  companyName: string;
  companyTypeId: string;
  salesId: string;
  sourceId: string;
  monthYear: string;
  status: LeadStatus;
  r1Status: LeadStepStatus;
  r2Status: LeadStepStatus;
  r3Status: LeadStepStatus;
  r3_2Status: LeadStepStatus;
  followUp: string;
  notes: string;
}

function getInitialState(lead: LeadWithRelations | null): FormState {
  return {
    contactFirstName: lead?.contact_first_name ?? "",
    contactLastName: lead?.contact_last_name ?? "",
    companyName: lead?.company_name ?? "",
    companyTypeId: lead?.company_type_id ?? "",
    salesId: lead?.sales_id ?? "",
    sourceId: lead?.source_id ?? "",
    monthYear: lead?.month_year
      ? lead.month_year.substring(0, 7)
      : "",
    status: lead?.status ?? "nouveau",
    r1Status: lead?.r1_status ?? "pending",
    r2Status: lead?.r2_status ?? "pending",
    r3Status: lead?.r3_status ?? "pending",
    r3_2Status: lead?.r3_2_status ?? "pending",
    followUp: lead?.follow_up ?? "",
    notes: lead?.notes ?? "",
  };
}

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  salesMembers,
  companyTypes,
  leadSources,
}: LeadFormDialogProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(getInitialState(lead));
  const notesVoice = useVoiceDictation(() => form.notes, (t) => updateField("notes", t));
  const [saving, setSaving] = useState(false);

  const isEditing = !!lead;

  useEffect(() => {
    setForm(getInitialState(lead));
  }, [lead]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = createClient();

      // 1. Find or create contact
      let contactId = lead?.contact_id ?? null;
      if (form.contactFirstName || form.contactLastName) {
        if (contactId && isEditing) {
          await supabase
            .from("contacts")
            .update({
              first_name: form.contactFirstName,
              last_name: form.contactLastName,
            })
            .eq("id", contactId);
        } else {
          const { data: newContact } = await supabase
            .from("contacts")
            .insert({
              first_name: form.contactFirstName,
              last_name: form.contactLastName,
            })
            .select("id")
            .single();
          contactId = newContact?.id ?? null;
        }
      }

      // 2. Find or create company
      let companyId = lead?.company_id ?? null;
      if (form.companyName) {
        if (companyId && isEditing) {
          await supabase
            .from("companies")
            .update({
              name: form.companyName,
              company_type_id: form.companyTypeId || null,
            })
            .eq("id", companyId);
        } else {
          const { data: newCompany } = await supabase
            .from("companies")
            .insert({
              name: form.companyName,
              company_type_id: form.companyTypeId || null,
            })
            .select("id")
            .single();
          companyId = newCompany?.id ?? null;
        }
      }

      // 3. Build lead data
      const leadData = {
        contact_id: contactId,
        company_id: companyId,
        company_type_id: form.companyTypeId || null,
        sales_id: form.salesId || null,
        source_id: form.sourceId || null,
        month_year: form.monthYear ? `${form.monthYear}-01` : null,
        status: form.status,
        r1_status: form.r1Status,
        r2_status: form.r2Status,
        r3_status: form.r3Status,
        r3_2_status: form.r3_2Status,
        follow_up: form.followUp || null,
        notes: form.notes || null,
      };

      if (isEditing && lead) {
        await supabase.from("leads").update(leadData).eq("id", lead.id);
      } else {
        await supabase.from("leads").insert(leadData);
      }

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du lead:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Modifier le lead" : "Nouveau lead"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifiez les informations du lead ci-dessous."
              : "Remplissez les informations pour créer un nouveau lead."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-4 pb-4">
          {/* Contact */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Contact
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contactFirstName">Prénom</Label>
                <Input
                  id="contactFirstName"
                  value={form.contactFirstName}
                  onChange={(e) =>
                    updateField("contactFirstName", e.target.value)
                  }
                  placeholder="Prénom"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactLastName">Nom</Label>
                <Input
                  id="contactLastName"
                  value={form.contactLastName}
                  onChange={(e) =>
                    updateField("contactLastName", e.target.value)
                  }
                  placeholder="Nom"
                />
              </div>
            </div>
          </div>

          {/* Company */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Entreprise
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Nom de l&apos;entreprise</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  placeholder="Nom de l'entreprise"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type d&apos;entreprise</Label>
                <Select
                  value={form.companyTypeId || undefined}
                  onValueChange={(val) =>
                    updateField("companyTypeId", val as string)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyTypes.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id}>
                        {ct.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Attribution
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sales</Label>
                <Select
                  value={form.salesId || undefined}
                  onValueChange={(val) =>
                    updateField("salesId", val as string)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select
                  value={form.sourceId || undefined}
                  onValueChange={(val) =>
                    updateField("sourceId", val as string)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Month and Status */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Infos lead
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="monthYear">Mois</Label>
                <Input
                  id="monthYear"
                  type="month"
                  value={form.monthYear}
                  onChange={(e) => updateField("monthYear", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select
                  value={form.status}
                  onValueChange={(val) =>
                    updateField("status", val as LeadStatus)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Step statuses */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Étapes
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["r1Status", "R1"],
                  ["r2Status", "R2"],
                  ["r3Status", "R3"],
                  ["r3_2Status", "R3_2"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Select
                    value={form[key]}
                    onValueChange={(val) =>
                      updateField(key, val as LeadStepStatus)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STEP_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {/* Follow-up and Notes */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Suivi
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="followUp">Suivi</Label>
              <Input
                id="followUp"
                value={form.followUp}
                onChange={(e) => updateField("followUp", e.target.value)}
                placeholder="Détails du suivi..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Notes additionnelles..."
                rows={3}
                className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              />
              <VoiceButton isRecording={notesVoice.isRecording} isFormatting={notesVoice.isFormatting} onClick={notesVoice.toggleRecording} tone={notesVoice.tone} onToneChange={notesVoice.setTone} />
            </div>
          </div>

          <SheetFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Sauvegarde..."
                : isEditing
                  ? "Mettre à jour"
                  : "Créer le lead"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
