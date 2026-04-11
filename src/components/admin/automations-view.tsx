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
  ArrowDown,
  Pencil,
  Plus,
  Trash2,
  Zap,
  Play,
  UserPlus,
  Building2,
  CalendarPlus,
  Send,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const CATEGORY_OPTIONS = CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

// Node styles par type
const NODE_STYLES: Record<string, { bg: string; border: string; text: string; icon: typeof Database }> = {
  data: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700", icon: Database },
  notification: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700", icon: Bell },
  calendar: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700", icon: Calendar },
  email: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700", icon: Mail },
};

// Actions predefinies pour la creation intuitive
const ACTION_TEMPLATES = [
  { value: "send-email", label: "Envoyer un email", icon: Send, type: "email", defaultName: "Envoyer un email", defaultDesc: "" },
  { value: "send-email-ics", label: "Envoyer un email avec .ics", icon: FileText, type: "email", defaultName: "Email avec invitation .ics", defaultDesc: "Envoie un email avec un fichier calendrier .ics en piece jointe" },
  { value: "google-calendar", label: "Ajouter sur l'agenda Google", icon: CalendarPlus, type: "calendar", defaultName: "Ajouter a Google Calendar", defaultDesc: "Cree un evenement dans le Google Calendar" },
  { value: "slack-notification", label: "Envoyer une notification Slack", icon: Bell, type: "notification", defaultName: "Notification Slack", defaultDesc: "Envoie un message Slack" },
  { value: "create-contact", label: "Creer/MAJ un contact", icon: UserPlus, type: "data", defaultName: "Creer/MAJ contact", defaultDesc: "Cree ou met a jour un contact dans le CRM" },
  { value: "create-company", label: "Creer/MAJ une entreprise", icon: Building2, type: "data", defaultName: "Creer/MAJ entreprise", defaultDesc: "Cree ou met a jour une entreprise" },
  { value: "create-meeting", label: "Creer un RDV", icon: Calendar, type: "data", defaultName: "Creer un RDV", defaultDesc: "Cree un rendez-vous commercial" },
  { value: "sync-data", label: "Synchroniser des donnees", icon: RefreshCw, type: "data", defaultName: "Sync donnees", defaultDesc: "Synchronise des donnees entre tables" },
  { value: "custom", label: "Action personnalisee", icon: Zap, type: "data", defaultName: "", defaultDesc: "" },
];

// Config fields par type
const CONFIG_FIELDS: Record<string, { key: string; label: string; placeholder: string; type?: string }[]> = {
  email: [
    { key: "recipient", label: "Destinataire", placeholder: "email@exemple.com ou 'dynamique'" },
    { key: "recipient_name", label: "Nom du destinataire", placeholder: "Ex: Pauline" },
    { key: "subject", label: "Objet de l'email", placeholder: "Ex: Nouveau lead — {{prenom}} {{nom}}" },
  ],
  notification: [
    { key: "channel", label: "Canal Slack", placeholder: "DM au membre assigne, ou ID du canal" },
  ],
  calendar: [
    { key: "calendar_type", label: "Type de calendrier", placeholder: "commercial, presentiel, ou ID specifique" },
  ],
  data: [
    { key: "target", label: "Cible", placeholder: "Ex: contacts, companies, meetings" },
  ],
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AutomationsView({ workflows: initialWorkflows }: { workflows: AutomationWorkflow[] }) {
  const { isAdmin, loaded } = useCurrentRoles();
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>(initialWorkflows);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Sheets
  const [editWorkflow, setEditWorkflow] = useState<AutomationWorkflow | null>(null);
  const [editStep, setEditStep] = useState<{ step: AutomationStep; workflowId: string } | null>(null);
  const [createWorkflow, setCreateWorkflow] = useState(false);
  const [addStep, setAddStep] = useState<string | null>(null);

  // Forms
  const [wfForm, setWfForm] = useState({ name: "", slug: "", description: "", category: "prise_de_rdv", trigger_description: "", api_route: "" });
  const [stepForm, setStepForm] = useState({ name: "", slug: "", description: "", step_type: "data", step_order: 0, config: {} as Record<string, unknown> });
  const [selectedAction, setSelectedAction] = useState("");

  if (!loaded) return <div className="text-muted-foreground p-8">Chargement...</div>;
  if (!isAdmin) return <div className="text-muted-foreground p-8">Acces reserve aux administrateurs.</div>;

  // ─── Group by category ─────────────────────────────────────────────────────

  const grouped = CATEGORY_ORDER.reduce<Record<string, AutomationWorkflow[]>>((acc, cat) => {
    acc[cat] = workflows.filter((w) => w.category === cat);
    return acc;
  }, {});

  // ─── API helpers ───────────────────────────────────────────────────────────

  async function toggleWorkflow(id: string, is_active: boolean) {
    setSaving(true);
    const res = await fetch(`/api/admin/automations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active }) });
    if (res.ok) setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, is_active } : w)));
    setSaving(false);
  }

  async function toggleStep(workflowId: string, stepId: string, is_active: boolean) {
    setSaving(true);
    const res = await fetch(`/api/admin/automations/${workflowId}/steps/${stepId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active }) });
    if (res.ok) setWorkflows((prev) => prev.map((w) => w.id === workflowId ? { ...w, automation_steps: w.automation_steps.map((s) => s.id === stepId ? { ...s, is_active } : s) } : w));
    setSaving(false);
  }

  async function saveWorkflow() {
    setSaving(true);
    if (editWorkflow) {
      const res = await fetch(`/api/admin/automations/${editWorkflow.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: wfForm.name, description: wfForm.description, category: wfForm.category, trigger_description: wfForm.trigger_description, api_route: wfForm.api_route }) });
      if (res.ok) { const updated = await res.json(); setWorkflows((prev) => prev.map((w) => w.id === editWorkflow.id ? { ...w, ...updated } : w)); setEditWorkflow(null); }
    }
    setSaving(false);
  }

  async function saveStep() {
    setSaving(true);
    if (editStep) {
      const res = await fetch(`/api/admin/automations/${editStep.workflowId}/steps/${editStep.step.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: stepForm.name, description: stepForm.description, step_type: stepForm.step_type, step_order: stepForm.step_order, config: stepForm.config }) });
      if (res.ok) { const updated = await res.json(); setWorkflows((prev) => prev.map((w) => w.id === editStep.workflowId ? { ...w, automation_steps: w.automation_steps.map((s) => s.id === editStep.step.id ? { ...s, ...updated } : s) } : w)); setEditStep(null); }
    }
    setSaving(false);
  }

  async function handleCreateWorkflow() {
    setSaving(true);
    const res = await fetch("/api/admin/automations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: wfForm.name, slug: wfForm.slug || slugify(wfForm.name), description: wfForm.description, category: wfForm.category, trigger_description: wfForm.trigger_description, api_route: wfForm.api_route }) });
    if (res.ok) { const created = await res.json(); setWorkflows((prev) => [...prev, { ...created, automation_steps: [] }]); setCreateWorkflow(false); setWfForm({ name: "", slug: "", description: "", category: "prise_de_rdv", trigger_description: "", api_route: "" }); }
    setSaving(false);
  }

  async function handleAddStep() {
    if (!addStep) return;
    setSaving(true);
    const wf = workflows.find((w) => w.id === addStep);
    const maxOrder = (wf?.automation_steps ?? []).reduce((max, s) => Math.max(max, s.step_order), 0);
    const res = await fetch(`/api/admin/automations/${addStep}/steps`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: stepForm.name, slug: stepForm.slug || slugify(stepForm.name), description: stepForm.description, step_type: stepForm.step_type, step_order: maxOrder + 1, config: stepForm.config }) });
    if (res.ok) { const created = await res.json(); setWorkflows((prev) => prev.map((w) => w.id === addStep ? { ...w, automation_steps: [...w.automation_steps, created] } : w)); setAddStep(null); setStepForm({ name: "", slug: "", description: "", step_type: "data", step_order: 0, config: {} }); setSelectedAction(""); }
    setSaving(false);
  }

  async function deleteWorkflow(id: string) {
    if (!confirm("Supprimer cette automatisation et toutes ses etapes ?")) return;
    setSaving(true);
    const res = await fetch(`/api/admin/automations/${id}`, { method: "DELETE" });
    if (res.ok) setWorkflows((prev) => prev.filter((w) => w.id !== id));
    setSaving(false);
  }

  async function deleteStep(workflowId: string, stepId: string) {
    if (!confirm("Supprimer cette etape ?")) return;
    setSaving(true);
    const res = await fetch(`/api/admin/automations/${workflowId}/steps/${stepId}`, { method: "DELETE" });
    if (res.ok) setWorkflows((prev) => prev.map((w) => w.id === workflowId ? { ...w, automation_steps: w.automation_steps.filter((s) => s.id !== stepId) } : w));
    setSaving(false);
  }

  // ─── UI helpers ────────────────────────────────────────────────────────────

  function toggleExpanded(id: string) {
    setExpandedWorkflows((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  }

  function openEditWorkflow(w: AutomationWorkflow) {
    setWfForm({ name: w.name, slug: w.slug, description: w.description ?? "", category: w.category, trigger_description: w.trigger_description ?? "", api_route: w.api_route ?? "" });
    setEditWorkflow(w);
  }
  function openEditStep(step: AutomationStep, workflowId: string) {
    setStepForm({ name: step.name, slug: step.slug, description: step.description ?? "", step_type: step.step_type, step_order: step.step_order, config: step.config ?? {} });
    setEditStep({ step, workflowId });
  }
  function openAddStep(workflowId: string) {
    setStepForm({ name: "", slug: "", description: "", step_type: "data", step_order: 0, config: {} });
    setSelectedAction("");
    setAddStep(workflowId);
  }

  function selectActionTemplate(actionValue: string) {
    setSelectedAction(actionValue);
    const tpl = ACTION_TEMPLATES.find((a) => a.value === actionValue);
    if (tpl) {
      setStepForm((f) => ({ ...f, name: tpl.defaultName, slug: slugify(tpl.defaultName || "custom"), description: tpl.defaultDesc, step_type: tpl.type }));
    }
  }

  function updateConfig(key: string, value: string) {
    setStepForm((f) => ({ ...f, config: { ...f.config, [key]: value } }));
  }

  // ─── Render: Step Node (n8n style) ─────────────────────────────────────────

  function StepNode({ step, workflowId, wfActive }: { step: AutomationStep; workflowId: string; wfActive: boolean }) {
    const style = NODE_STYLES[step.step_type] ?? NODE_STYLES.data;
    const Icon = style.icon;
    return (
      <div className={`relative rounded-xl border-2 ${style.border} ${style.bg} px-4 py-3 min-w-[200px] max-w-[280px] transition-all ${!step.is_active ? "opacity-40" : ""}`}>
        <div className="flex items-start gap-3">
          <div className={`rounded-lg p-2 ${style.text} bg-white/70 shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${style.text} leading-tight`}>{step.name}</p>
            {step.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{step.description}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
          <Switch checked={step.is_active} onCheckedChange={(v) => toggleStep(workflowId, step.id, v)} disabled={saving || !wfActive} size="sm" />
          <div className="flex gap-1">
            <button onClick={() => openEditStep(step, workflowId)} className="p-1 rounded hover:bg-black/5 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
            <button onClick={() => deleteStep(workflowId, step.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Visualisez et gerez les automatisations du CRM.</p>
        <Button onClick={() => { setWfForm({ name: "", slug: "", description: "", category: "prise_de_rdv", trigger_description: "", api_route: "" }); setCreateWorkflow(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nouvelle automatisation
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
            <CardHeader className="cursor-pointer select-none" onClick={() => toggleCategory(cat)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <CardTitle className="text-base">{CATEGORY_LABELS[cat] ?? cat}</CardTitle>
                  <span className="text-xs text-muted-foreground">{activeCount}/{items.length} actif{activeCount > 1 ? "s" : ""}</span>
                </div>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="space-y-3 pt-0">
                {items.map((wf) => {
                  const isExpanded = expandedWorkflows.has(wf.id);
                  return (
                    <div key={wf.id} className="rounded-xl border bg-background overflow-hidden">
                      {/* Workflow header */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button onClick={() => toggleExpanded(wf.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{wf.name}</span>
                            {wf.api_route && <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{wf.api_route}</span>}
                          </div>
                          {wf.trigger_description && <p className="text-xs text-muted-foreground mt-0.5">{wf.trigger_description}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{wf.automation_steps.length} etape{wf.automation_steps.length > 1 ? "s" : ""}</span>
                          <Switch checked={wf.is_active} onCheckedChange={(v) => toggleWorkflow(wf.id, v)} disabled={saving} size="sm" />
                          <button onClick={() => openEditWorkflow(wf)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => deleteWorkflow(wf.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>

                      {/* n8n-style flow (expanded) */}
                      {isExpanded && (
                        <div className="border-t bg-[#f8fafb] px-6 py-6">
                          {/* Trigger node */}
                          <div className="flex flex-col items-center">
                            <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 px-5 py-3 text-center max-w-[320px]">
                              <div className="flex items-center justify-center gap-2 mb-1">
                                <Play className="h-4 w-4 text-emerald-600" />
                                <span className="text-sm font-bold text-emerald-700">Declencheur</span>
                              </div>
                              <p className="text-xs text-emerald-600">{wf.trigger_description || wf.name}</p>
                            </div>

                            {wf.automation_steps.length > 0 && (
                              <div className="flex flex-col items-center my-2">
                                <div className="w-0.5 h-4 bg-gray-300" />
                                <ArrowDown className="h-4 w-4 text-gray-400 -mt-1" />
                              </div>
                            )}
                          </div>

                          {/* Step nodes */}
                          <div className="flex flex-wrap justify-center gap-4">
                            {wf.automation_steps.map((step, idx) => (
                              <div key={step.id} className="flex flex-col items-center">
                                <StepNode step={step} workflowId={wf.id} wfActive={wf.is_active} />
                                {idx < wf.automation_steps.length - 1 && (
                                  <div className="flex flex-col items-center my-2">
                                    <div className="w-0.5 h-3 bg-gray-300" />
                                    <ArrowDown className="h-3 w-3 text-gray-400 -mt-0.5" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Add step button */}
                          <div className="flex justify-center mt-4">
                            <button
                              onClick={() => openAddStep(wf.id)}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                            >
                              <Plus className="h-4 w-4" /> Ajouter une etape
                            </button>
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
        <SheetContent side="right" className="max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Modifier l&apos;automatisation</SheetTitle>
            <SheetDescription>Modifiez les proprietes de cette automatisation.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-6">
            <Field label="Nom" value={wfForm.name} onChange={(v) => setWfForm((f) => ({ ...f, name: v }))} />
            <Field label="Slug" value={wfForm.slug} disabled hint="Identifiant unique (utilise dans le code)" />
            <div>
              <label className="text-sm font-medium">Categorie</label>
              <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={wfForm.category} onChange={(e) => setWfForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Field label="Declencheur" value={wfForm.trigger_description} onChange={(v) => setWfForm((f) => ({ ...f, trigger_description: v }))} placeholder="Ex: Un prospect prend RDV" />
            <Field label="Description" value={wfForm.description} onChange={(v) => setWfForm((f) => ({ ...f, description: v }))} multiline />
            <Field label="Route API" value={wfForm.api_route} onChange={(v) => setWfForm((f) => ({ ...f, api_route: v }))} placeholder="/api/..." mono />
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setEditWorkflow(null)}>Annuler</Button>
            <Button onClick={saveWorkflow} disabled={saving || !wfForm.name}>{saving ? "..." : "Enregistrer"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ─── Sheet: Edit Step ──────────────────────────────────────────────── */}
      <Sheet open={!!editStep} onOpenChange={(o) => !o && setEditStep(null)}>
        <SheetContent side="right" className="max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Modifier l&apos;etape</SheetTitle>
            <SheetDescription>Modifiez les proprietes de cette etape.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-6">
            <Field label="Nom" value={stepForm.name} onChange={(v) => setStepForm((f) => ({ ...f, name: v }))} />
            <Field label="Slug" value={stepForm.slug} disabled />
            <div>
              <label className="text-sm font-medium">Type d&apos;action</label>
              <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={stepForm.step_type} onChange={(e) => setStepForm((f) => ({ ...f, step_type: e.target.value }))}>
                <option value="email">Envoyer un email</option>
                <option value="calendar">Ajouter sur l&apos;agenda</option>
                <option value="notification">Notification Slack</option>
                <option value="data">Gestion de donnees</option>
              </select>
            </div>
            <Field label="Description" value={stepForm.description} onChange={(v) => setStepForm((f) => ({ ...f, description: v }))} multiline />
            {/* Config fields */}
            {(CONFIG_FIELDS[stepForm.step_type] ?? []).map((field) => (
              <Field key={field.key} label={field.label} value={String(stepForm.config[field.key] ?? "")} onChange={(v) => updateConfig(field.key, v)} placeholder={field.placeholder} />
            ))}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setEditStep(null)}>Annuler</Button>
            <Button onClick={saveStep} disabled={saving || !stepForm.name}>{saving ? "..." : "Enregistrer"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ─── Sheet: Create Workflow ────────────────────────────────────────── */}
      <Sheet open={createWorkflow} onOpenChange={(o) => !o && setCreateWorkflow(false)}>
        <SheetContent side="right" className="max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nouvelle automatisation</SheetTitle>
            <SheetDescription>Creez une nouvelle automatisation.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-6">
            <Field label="Nom *" value={wfForm.name} onChange={(v) => setWfForm((f) => ({ ...f, name: v, slug: slugify(v) }))} placeholder="Ex: Notification nouveau lead" />
            <div>
              <label className="text-sm font-medium">Categorie *</label>
              <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={wfForm.category} onChange={(e) => setWfForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Field label="Declencheur *" value={wfForm.trigger_description} onChange={(v) => setWfForm((f) => ({ ...f, trigger_description: v }))} placeholder="Ex: Un prospect remplit un formulaire" />
            <Field label="Description" value={wfForm.description} onChange={(v) => setWfForm((f) => ({ ...f, description: v }))} multiline />
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setCreateWorkflow(false)}>Annuler</Button>
            <Button onClick={handleCreateWorkflow} disabled={saving || !wfForm.name}>{saving ? "..." : "Creer"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ─── Sheet: Add Step (n8n-style action picker) ─────────────────────── */}
      <Sheet open={!!addStep} onOpenChange={(o) => { if (!o) { setAddStep(null); setSelectedAction(""); } }}>
        <SheetContent side="right" className="max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Ajouter une etape</SheetTitle>
            <SheetDescription>Choisissez le type d&apos;action a ajouter.</SheetDescription>
          </SheetHeader>
          <div className="p-6">
            {!selectedAction ? (
              /* Action picker grid */
              <div className="grid grid-cols-2 gap-3">
                {ACTION_TEMPLATES.map((action) => {
                  const Icon = action.icon;
                  const nodeStyle = NODE_STYLES[action.type] ?? NODE_STYLES.data;
                  return (
                    <button
                      key={action.value}
                      onClick={() => selectActionTemplate(action.value)}
                      className={`flex items-center gap-3 rounded-xl border-2 ${nodeStyle.border} ${nodeStyle.bg} p-4 text-left hover:shadow-md transition-all`}
                    >
                      <div className={`rounded-lg p-2 bg-white/70 ${nodeStyle.text}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`text-sm font-medium ${nodeStyle.text}`}>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Step config form */
              <div className="space-y-4">
                <button onClick={() => setSelectedAction("")} className="text-sm text-primary hover:underline mb-2">&larr; Changer le type d&apos;action</button>
                <Field label="Nom de l'etape *" value={stepForm.name} onChange={(v) => setStepForm((f) => ({ ...f, name: v, slug: slugify(v) }))} />
                <Field label="Description" value={stepForm.description} onChange={(v) => setStepForm((f) => ({ ...f, description: v }))} multiline placeholder="Decrivez ce que fait cette etape" />
                {/* Config fields based on type */}
                {(CONFIG_FIELDS[stepForm.step_type] ?? []).map((field) => (
                  <Field key={field.key} label={field.label} value={String(stepForm.config[field.key] ?? "")} onChange={(v) => updateConfig(field.key, v)} placeholder={field.placeholder} />
                ))}
              </div>
            )}
          </div>
          {selectedAction && (
            <SheetFooter>
              <Button variant="outline" onClick={() => { setAddStep(null); setSelectedAction(""); }}>Annuler</Button>
              <Button onClick={handleAddStep} disabled={saving || !stepForm.name}>{saving ? "..." : "Ajouter"}</Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Reusable Field ──────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, disabled, hint, multiline, mono }: {
  label: string; value: string; onChange?: (v: string) => void; placeholder?: string; disabled?: boolean; hint?: string; multiline?: boolean; mono?: boolean;
}) {
  const cls = `mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm ${mono ? "font-mono" : ""} ${disabled ? "bg-muted text-muted-foreground" : ""}`;
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      {multiline ? (
        <textarea className={cls} rows={3} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled} />
      ) : (
        <input className={cls} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled} />
      )}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
