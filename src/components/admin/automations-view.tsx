"use client";

import { useState } from "react";
import { useCurrentRoles } from "@/lib/use-current-roles";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Database,
  Bell,
  Mail,
  Pencil,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AutomationStep {
  id: string;
  workflow_id: string;
  slug: string;
  name: string;
  description: string | null;
  step_type: string;
  step_order: number;
  is_active: boolean;
  config: Record<string, unknown>;
}

interface AutomationWorkflow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  trigger_description: string | null;
  api_route: string | null;
  is_active: boolean;
  config: Record<string, unknown>;
  automation_steps: AutomationStep[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  prise_de_rdv: "Prise de RDV",
  notifications_rdv: "Notifications RDV",
  sessions_formation: "Sessions de Formation",
  tunnel_landing: "Tunnel / Landing Pages",
  taches_rappels: "Tâches & Rappels",
};

const CATEGORY_ORDER = [
  "prise_de_rdv",
  "notifications_rdv",
  "sessions_formation",
  "tunnel_landing",
  "taches_rappels",
];

const STEP_TYPE_STYLES: Record<string, { label: string; bg: string; text: string; icon: typeof Database }> = {
  data: { label: "Données", bg: "bg-blue-100", text: "text-blue-800", icon: Database },
  notification: { label: "Notification", bg: "bg-purple-100", text: "text-purple-800", icon: Bell },
  calendar: { label: "Calendrier", bg: "bg-green-100", text: "text-green-800", icon: Calendar },
  email: { label: "Email", bg: "bg-orange-100", text: "text-orange-800", icon: Mail },
};

const STEP_TYPE_OPTIONS = [
  { value: "data", label: "Données" },
  { value: "notification", label: "Notification" },
  { value: "calendar", label: "Calendrier" },
  { value: "email", label: "Email" },
];

const CATEGORY_OPTIONS = CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

// ─── Helper ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AutomationsView({ workflows: initialWorkflows }: { workflows: AutomationWorkflow[] }) {
  const { isAdmin, loaded } = useCurrentRoles();
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>(initialWorkflows);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Edit sheets
  const [editWorkflow, setEditWorkflow] = useState<AutomationWorkflow | null>(null);
  const [editStep, setEditStep] = useState<{ step: AutomationStep; workflowId: string } | null>(null);
  const [createWorkflow, setCreateWorkflow] = useState(false);
  const [addStep, setAddStep] = useState<string | null>(null); // workflow ID

  // Form state
  const [wfForm, setWfForm] = useState({ name: "", slug: "", description: "", category: "prise_de_rdv", trigger_description: "", api_route: "" });
  const [stepForm, setStepForm] = useState({ name: "", slug: "", description: "", step_type: "data", step_order: 0, config: "{}" });

  if (!loaded) return <div className="text-muted-foreground p-8">Chargement...</div>;
  if (!isAdmin) return <div className="text-muted-foreground p-8">Accès réservé aux administrateurs.</div>;

  // ─── Group by category ─────────────────────────────────────────────────────

  const grouped = CATEGORY_ORDER.reduce<Record<string, AutomationWorkflow[]>>((acc, cat) => {
    acc[cat] = workflows.filter((w) => w.category === cat);
    return acc;
  }, {});

  // ─── API helpers ───────────────────────────────────────────────────────────

  async function toggleWorkflow(id: string, is_active: boolean) {
    setSaving(true);
    const res = await fetch(`/api/admin/automations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    if (res.ok) {
      setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, is_active } : w)));
    }
    setSaving(false);
  }

  async function toggleStep(workflowId: string, stepId: string, is_active: boolean) {
    setSaving(true);
    const res = await fetch(`/api/admin/automations/${workflowId}/steps/${stepId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    if (res.ok) {
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflowId
            ? { ...w, automation_steps: w.automation_steps.map((s) => (s.id === stepId ? { ...s, is_active } : s)) }
            : w
        )
      );
    }
    setSaving(false);
  }

  async function saveWorkflow() {
    setSaving(true);
    if (editWorkflow) {
      const res = await fetch(`/api/admin/automations/${editWorkflow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: wfForm.name,
          description: wfForm.description,
          category: wfForm.category,
          trigger_description: wfForm.trigger_description,
          api_route: wfForm.api_route,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setWorkflows((prev) => prev.map((w) => (w.id === editWorkflow.id ? { ...w, ...updated } : w)));
        setEditWorkflow(null);
      }
    }
    setSaving(false);
  }

  async function saveStep() {
    setSaving(true);
    if (editStep) {
      let parsedConfig = {};
      try { parsedConfig = JSON.parse(stepForm.config); } catch { /* keep empty */ }

      const res = await fetch(`/api/admin/automations/${editStep.workflowId}/steps/${editStep.step.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stepForm.name,
          description: stepForm.description,
          step_type: stepForm.step_type,
          step_order: stepForm.step_order,
          config: parsedConfig,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === editStep.workflowId
              ? { ...w, automation_steps: w.automation_steps.map((s) => (s.id === editStep.step.id ? { ...s, ...updated } : s)) }
              : w
          )
        );
        setEditStep(null);
      }
    }
    setSaving(false);
  }

  async function handleCreateWorkflow() {
    setSaving(true);
    const res = await fetch("/api/admin/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: wfForm.name,
        slug: wfForm.slug || slugify(wfForm.name),
        description: wfForm.description,
        category: wfForm.category,
        trigger_description: wfForm.trigger_description,
        api_route: wfForm.api_route,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setWorkflows((prev) => [...prev, { ...created, automation_steps: [] }]);
      setCreateWorkflow(false);
      setWfForm({ name: "", slug: "", description: "", category: "prise_de_rdv", trigger_description: "", api_route: "" });
    }
    setSaving(false);
  }

  async function handleAddStep() {
    if (!addStep) return;
    setSaving(true);
    let parsedConfig = {};
    try { parsedConfig = JSON.parse(stepForm.config); } catch { /* keep empty */ }

    const wf = workflows.find((w) => w.id === addStep);
    const maxOrder = (wf?.automation_steps ?? []).reduce((max, s) => Math.max(max, s.step_order), 0);

    const res = await fetch(`/api/admin/automations/${addStep}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: stepForm.name,
        slug: stepForm.slug || slugify(stepForm.name),
        description: stepForm.description,
        step_type: stepForm.step_type,
        step_order: maxOrder + 1,
        config: parsedConfig,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === addStep ? { ...w, automation_steps: [...w.automation_steps, created] } : w
        )
      );
      setAddStep(null);
      setStepForm({ name: "", slug: "", description: "", step_type: "data", step_order: 0, config: "{}" });
    }
    setSaving(false);
  }

  async function deleteWorkflow(id: string) {
    if (!confirm("Supprimer cette automatisation et toutes ses étapes ?")) return;
    setSaving(true);
    const res = await fetch(`/api/admin/automations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    }
    setSaving(false);
  }

  async function deleteStep(workflowId: string, stepId: string) {
    if (!confirm("Supprimer cette étape ?")) return;
    setSaving(true);
    const res = await fetch(`/api/admin/automations/${workflowId}/steps/${stepId}`, { method: "DELETE" });
    if (res.ok) {
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflowId
            ? { ...w, automation_steps: w.automation_steps.filter((s) => s.id !== stepId) }
            : w
        )
      );
    }
    setSaving(false);
  }

  // ─── Toggle helpers ────────────────────────────────────────────────────────

  function toggleExpanded(id: string) {
    setExpandedWorkflows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  // ─── Open edit forms ───────────────────────────────────────────────────────

  function openEditWorkflow(w: AutomationWorkflow) {
    setWfForm({
      name: w.name,
      slug: w.slug,
      description: w.description ?? "",
      category: w.category,
      trigger_description: w.trigger_description ?? "",
      api_route: w.api_route ?? "",
    });
    setEditWorkflow(w);
  }

  function openEditStep(step: AutomationStep, workflowId: string) {
    setStepForm({
      name: step.name,
      slug: step.slug,
      description: step.description ?? "",
      step_type: step.step_type,
      step_order: step.step_order,
      config: JSON.stringify(step.config, null, 2),
    });
    setEditStep({ step, workflowId });
  }

  function openCreateWorkflow() {
    setWfForm({ name: "", slug: "", description: "", category: "prise_de_rdv", trigger_description: "", api_route: "" });
    setCreateWorkflow(true);
  }

  function openAddStep(workflowId: string) {
    setStepForm({ name: "", slug: "", description: "", step_type: "data", step_order: 0, config: "{}" });
    setAddStep(workflowId);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Gérez les automatisations du CRM. Activez/désactivez des workflows ou des étapes individuelles.
          </p>
        </div>
        <Button onClick={openCreateWorkflow} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle automatisation
        </Button>
      </div>

      {/* Categories */}
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        const isCollapsed = collapsedCategories.has(cat);
        const activeCount = items.filter((w) => w.is_active).length;

        return (
          <Card key={cat}>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => toggleCategory(cat)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <CardTitle className="text-base">{CATEGORY_LABELS[cat] ?? cat}</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {activeCount}/{items.length} actif{activeCount > 1 ? "s" : ""}
                  </span>
                </div>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="space-y-2 pt-0">
                {items.map((wf) => {
                  const isExpanded = expandedWorkflows.has(wf.id);
                  return (
                    <div key={wf.id} className="rounded-lg border bg-background">
                      {/* Workflow row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button
                          onClick={() => toggleExpanded(wf.id)}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{wf.name}</span>
                            {wf.api_route && (
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {wf.api_route}
                              </span>
                            )}
                          </div>
                          {wf.trigger_description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{wf.trigger_description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {wf.automation_steps.length} étape{wf.automation_steps.length > 1 ? "s" : ""}
                          </span>
                          <Switch
                            checked={wf.is_active}
                            onCheckedChange={(val) => toggleWorkflow(wf.id, val)}
                            disabled={saving}
                            size="sm"
                          />
                          <Button variant="ghost" size="icon-xs" onClick={() => openEditWorkflow(wf)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon-xs" onClick={() => deleteWorkflow(wf.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {/* Steps (expanded) */}
                      {isExpanded && (
                        <div className="border-t px-4 py-2 space-y-1 bg-muted/30">
                          {wf.description && (
                            <p className="text-xs text-muted-foreground pb-2">{wf.description}</p>
                          )}
                          {wf.automation_steps.map((step, idx) => {
                            const typeStyle = STEP_TYPE_STYLES[step.step_type] ?? STEP_TYPE_STYLES.data;
                            const TypeIcon = typeStyle.icon;
                            return (
                              <div key={step.id} className="flex items-center gap-3 py-1.5 pl-2">
                                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{idx + 1}.</span>
                                <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${typeStyle.text}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm truncate">{step.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeStyle.bg} ${typeStyle.text}`}>
                                      {typeStyle.label}
                                    </span>
                                  </div>
                                  {step.description && (
                                    <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Switch
                                    checked={step.is_active}
                                    onCheckedChange={(val) => toggleStep(wf.id, step.id, val)}
                                    disabled={saving || !wf.is_active}
                                    size="sm"
                                  />
                                  <Button variant="ghost" size="icon-xs" onClick={() => openEditStep(step, wf.id)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon-xs" onClick={() => deleteStep(wf.id, step.id)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                          <div className="pt-2">
                            <Button variant="ghost" size="xs" onClick={() => openAddStep(wf.id)}>
                              <Plus className="h-3 w-3 mr-1" />
                              Ajouter une étape
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* ─── Sheet: Edit Workflow ───────────────────────────────────────────── */}
      <Sheet open={!!editWorkflow} onOpenChange={(o) => !o && setEditWorkflow(null)}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Modifier l&apos;automatisation</SheetTitle>
            <SheetDescription>Modifiez les propriétés de cette automatisation.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Nom</label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={wfForm.name}
                onChange={(e) => setWfForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <input
                className="mt-1 w-full rounded-md border bg-muted px-3 py-2 text-sm font-mono"
                value={wfForm.slug}
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">Le slug ne peut pas être modifié (utilisé dans le code).</p>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={3}
                value={wfForm.description}
                onChange={(e) => setWfForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Catégorie</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={wfForm.category}
                onChange={(e) => setWfForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Déclencheur</label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={wfForm.trigger_description}
                onChange={(e) => setWfForm((f) => ({ ...f, trigger_description: e.target.value }))}
                placeholder="Ex: Un prospect remplit le formulaire de booking"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Route API</label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                value={wfForm.api_route}
                onChange={(e) => setWfForm((f) => ({ ...f, api_route: e.target.value }))}
                placeholder="/api/booking/confirm"
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setEditWorkflow(null)}>Annuler</Button>
            <Button onClick={saveWorkflow} disabled={saving || !wfForm.name}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ─── Sheet: Edit Step ──────────────────────────────────────────────── */}
      <Sheet open={!!editStep} onOpenChange={(o) => !o && setEditStep(null)}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Modifier l&apos;étape</SheetTitle>
            <SheetDescription>Modifiez les propriétés et la configuration de cette étape.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Nom</label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={stepForm.name}
                onChange={(e) => setStepForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <input
                className="mt-1 w-full rounded-md border bg-muted px-3 py-2 text-sm font-mono"
                value={stepForm.slug}
                disabled
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={2}
                value={stepForm.description}
                onChange={(e) => setStepForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={stepForm.step_type}
                onChange={(e) => setStepForm((f) => ({ ...f, step_type: e.target.value }))}
              >
                {STEP_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Ordre</label>
              <input
                type="number"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={stepForm.step_order}
                onChange={(e) => setStepForm((f) => ({ ...f, step_order: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Configuration (JSON)</label>
              <textarea
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                rows={6}
                value={stepForm.config}
                onChange={(e) => setStepForm((f) => ({ ...f, config: e.target.value }))}
                placeholder='{"recipient": "email@example.com"}'
              />
              <p className="text-xs text-muted-foreground mt-1">Configuration spécifique à l&apos;étape (destinataires, templates, etc.)</p>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setEditStep(null)}>Annuler</Button>
            <Button onClick={saveStep} disabled={saving || !stepForm.name}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ─── Sheet: Create Workflow ────────────────────────────────────────── */}
      <Sheet open={createWorkflow} onOpenChange={(o) => !o && setCreateWorkflow(false)}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nouvelle automatisation</SheetTitle>
            <SheetDescription>Créez une nouvelle automatisation avec ses propriétés.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Nom *</label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={wfForm.name}
                onChange={(e) => setWfForm((f) => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
                placeholder="Ex: Notification nouveau lead"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <input
                className="mt-1 w-full rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono"
                value={wfForm.slug}
                onChange={(e) => setWfForm((f) => ({ ...f, slug: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Identifiant unique, généré automatiquement.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Catégorie *</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={wfForm.category}
                onChange={(e) => setWfForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={3}
                value={wfForm.description}
                onChange={(e) => setWfForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Déclencheur</label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={wfForm.trigger_description}
                onChange={(e) => setWfForm((f) => ({ ...f, trigger_description: e.target.value }))}
                placeholder="Ex: Un prospect remplit un formulaire"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Route API</label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                value={wfForm.api_route}
                onChange={(e) => setWfForm((f) => ({ ...f, api_route: e.target.value }))}
                placeholder="/api/example/route"
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setCreateWorkflow(false)}>Annuler</Button>
            <Button onClick={handleCreateWorkflow} disabled={saving || !wfForm.name}>
              {saving ? "Création..." : "Créer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ─── Sheet: Add Step ───────────────────────────────────────────────── */}
      <Sheet open={!!addStep} onOpenChange={(o) => !o && setAddStep(null)}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Ajouter une étape</SheetTitle>
            <SheetDescription>Ajoutez une nouvelle étape à cette automatisation.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Nom *</label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={stepForm.name}
                onChange={(e) => setStepForm((f) => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
                placeholder="Ex: Envoyer email de confirmation"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <input
                className="mt-1 w-full rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono"
                value={stepForm.slug}
                onChange={(e) => setStepForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type *</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={stepForm.step_type}
                onChange={(e) => setStepForm((f) => ({ ...f, step_type: e.target.value }))}
              >
                {STEP_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={2}
                value={stepForm.description}
                onChange={(e) => setStepForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Configuration (JSON)</label>
              <textarea
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                rows={4}
                value={stepForm.config}
                onChange={(e) => setStepForm((f) => ({ ...f, config: e.target.value }))}
                placeholder='{"recipient": "email@example.com"}'
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setAddStep(null)}>Annuler</Button>
            <Button onClick={handleAddStep} disabled={saving || !stepForm.name}>
              {saving ? "Ajout..." : "Ajouter"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
