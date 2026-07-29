/**
 * Notifie Naznine (Finance) qu'une pièce ADV attend sa validation.
 * Best-effort : ne doit JAMAIS faire échouer la génération de la pièce.
 * Réutilise la table notifications + sendSessionEmail (pattern webhook Firma).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRecipientEmail } from "@/lib/adv-quote";
import { sendSessionEmail } from "@/lib/send-email";

const NAZNINE_EMAIL = "naznine@ifagroupe.com";

export async function notifyPieceToValidate(
  supabase: SupabaseClient,
  piece: { type: "devis" | "convention" | "facture"; label: string; dealId?: string | null },
): Promise<void> {
  const typeLabel =
    piece.type === "devis" ? "Devis" : piece.type === "convention" ? "Convention" : "Facture";
  try {
    const { data: naznine } = await supabase
      .from("team_members")
      .select("id")
      .eq("email", NAZNINE_EMAIL)
      .maybeSingle();
    if (naznine) {
      await supabase.from("notifications").insert({
        recipient_id: naznine.id,
        type: "adv_to_validate",
        title: `${typeLabel} à valider`,
        body: `${typeLabel} prêt(e) : "${piece.label}". À prévisualiser et valider avant envoi.`,
        link_url: "/a-valider",
        related_entity_type: piece.dealId ? "deal" : null,
        related_entity_id: piece.dealId ?? null,
      });
    }
    await sendSessionEmail({
      to: resolveRecipientEmail(NAZNINE_EMAIL),
      subject: `${typeLabel} à valider — IFA Formation`,
      body: `Bonjour,\n\nUn(e) ${typeLabel.toLowerCase()} est prêt(e) à être validé(e) : "${piece.label}".\n\nPrévisualise et valide avant envoi : https://crm-lca.vercel.app/a-valider`,
    });
  } catch (err) {
    console.error("notifyPieceToValidate failed:", err);
  }
}
