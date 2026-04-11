import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface StepConfig {
  active: boolean;
  config: Record<string, unknown>;
}

export interface WorkflowConfig {
  id: string;
  is_active: boolean;
  config: Record<string, unknown>;
  steps: Map<string, { is_active: boolean; config: Record<string, unknown> }>;
}

/**
 * Load full workflow config (workflow + all steps) in a single query.
 * Returns null if workflow doesn't exist in DB — caller defaults to active.
 */
export async function loadWorkflow(slug: string): Promise<WorkflowConfig | null> {
  const { data: workflow } = await supabase
    .from("automation_workflows")
    .select("id, is_active, config, automation_steps(slug, is_active, config)")
    .eq("slug", slug)
    .single();

  if (!workflow) return null;

  const steps = new Map<string, { is_active: boolean; config: Record<string, unknown> }>();
  for (const s of (workflow.automation_steps ?? []) as any[]) {
    steps.set(s.slug, { is_active: s.is_active, config: s.config ?? {} });
  }

  return {
    id: workflow.id,
    is_active: workflow.is_active,
    config: (workflow.config as Record<string, unknown>) ?? {},
    steps,
  };
}

/**
 * Check if a specific step within a workflow is active.
 * Defaults to active (true) if workflow or step not found — existing behavior preserved.
 */
export function isStepActive(workflow: WorkflowConfig | null, stepSlug: string): StepConfig {
  if (!workflow) return { active: true, config: {} };
  if (!workflow.is_active) return { active: false, config: {} };
  const step = workflow.steps.get(stepSlug);
  if (!step) return { active: true, config: {} };
  return { active: step.is_active, config: step.config };
}
