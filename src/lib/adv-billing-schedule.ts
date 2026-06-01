/**
 * Helpers du planificateur de facturation (port ADV).
 * Découplé de la route cron pour rester testable et lisible.
 */

export type BillingAutoMode = "validate" | "auto";

export function billingAutoMode(): BillingAutoMode {
  return process.env.BILLING_AUTO_MODE === "auto" ? "auto" : "validate";
}

/**
 * Gate OPCO : une échéance OPCO ne s'auto-facture que si la convention du deal est signée.
 * UP FRONT (et tout funding_type non-OPCO) : pas de gate.
 * `fundingType` provient de billing_entries.funding_type ; `conventionSignedAt` de deals.
 */
export function isOpcoConventionSatisfied(
  fundingType: string | null,
  conventionSignedAt: string | null,
): boolean {
  if ((fundingType ?? "").toUpperCase() !== "OPCO") return true;
  return conventionSignedAt != null;
}
