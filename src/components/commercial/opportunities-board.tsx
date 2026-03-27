"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, TrendingUp, ArrowRightLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Opportunity {
  id: string;
  name: string;
  amount: number | null;
  training_days: number | null;
  stage: string;
  is_planned: boolean;
  notes: string | null;
  companies: { name: string } | null;
  contacts: { first_name: string; last_name: string } | null;
  team_members: { first_name: string; last_name: string } | null;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
}

function formatCurrency(amount: number | null) {
  if (!amount) return "0 €";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function OpportunityCard({ opp }: { opp: Opportunity }) {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <p className="font-medium text-sm leading-tight">{opp.name}</p>
            {opp.companies && (
              <p className="text-xs text-muted-foreground">{opp.companies.name}</p>
            )}
          </div>
          {opp.is_planned && opp.stage === "pipe" && (
            <Badge variant="secondary" className="text-xs ml-2">Planifié</Badge>
          )}
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm font-semibold">{formatCurrency(opp.amount)}</span>
          <span className="text-xs text-muted-foreground">
            {opp.training_days ? `${Number(opp.training_days).toFixed(1)}j` : "—"}
          </span>
        </div>
        {opp.team_members && (
          <p className="text-xs text-muted-foreground mt-1">
            {opp.team_members.first_name} {opp.team_members.last_name}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function OpportunitiesBoard({
  opportunities,
  teamMembers,
}: {
  opportunities: Opportunity[];
  teamMembers: TeamMember[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company_name: "",
    amount: "",
    training_days: "",
    sales_id: "",
    stage: "opportunité" as string,
    is_planned: false,
    notes: "",
  });

  const opps = opportunities.filter((o) => o.stage === "opportunité");
  const pipe = opportunities.filter((o) => o.stage === "pipe");

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    let companyId: string | null = null;
    if (form.company_name.trim()) {
      const { data: existing } = await supabase
        .from("companies")
        .select("id")
        .eq("name", form.company_name.trim())
        .limit(1)
        .single();

      if (existing) {
        companyId = existing.id;
      } else {
        const { data: newCo } = await supabase
          .from("companies")
          .insert({ name: form.company_name.trim() })
          .select("id")
          .single();
        companyId = newCo?.id ?? null;
      }
    }

    await supabase.from("opportunities").insert({
      name: form.name,
      company_id: companyId,
      sales_id: form.sales_id || null,
      amount: form.amount ? parseFloat(form.amount) : null,
      training_days: form.training_days ? parseFloat(form.training_days) : null,
      stage: form.stage,
      is_planned: form.is_planned,
      notes: form.notes || null,
    });

    setSaving(false);
    setOpen(false);
    setForm({ name: "", company_name: "", amount: "", training_days: "", sales_id: "", stage: "opportunité", is_planned: false, notes: "" });
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle opportunité
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-lg">Opportunités</h3>
            <Badge variant="outline">{opps.length}</Badge>
          </div>
          {opps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune opportunité</p>
          ) : (
            opps.map((o) => <OpportunityCard key={o.id} opp={o} />)
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Pipe</h3>
            <Badge variant="outline">{pipe.length}</Badge>
          </div>
          {pipe.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun deal en pipe</p>
          ) : (
            pipe.map((o) => <OpportunityCard key={o.id} opp={o} />)
          )}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nouvelle opportunité</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Nom du deal *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Formation Excellence WSE"
              />
            </div>
            <div className="space-y-2">
              <Label>Entreprise</Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Nom de l'entreprise"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Montant (€)</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Jours de formation</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.training_days}
                  onChange={(e) => setForm({ ...form, training_days: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expert</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.sales_id}
                onChange={(e) => setForm({ ...form, sales_id: e.target.value })}
              >
                <option value="">Sélectionner</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
              >
                <option value="opportunité">Opportunité</option>
                <option value="pipe">Pipe</option>
                <option value="gagné">Gagné</option>
                <option value="perdu">Perdu</option>
              </select>
            </div>
            {form.stage === "pipe" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_planned}
                  onChange={(e) => setForm({ ...form, is_planned: e.target.checked })}
                  className="rounded border"
                />
                Déjà planifié
              </label>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="w-full"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
