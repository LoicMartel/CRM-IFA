import { NextResponse } from "next/server";
import { requireMember } from "@/lib/api-auth";
import type { VisioformationPayload } from "@/lib/visioformation-client";

// Endpoint de TEST demandé par Joseph (VisioFormation, mail 06/07) : un bouton qui, au clic, envoie un
// webhook (payload JSON au format ADF) vers l'URL de préprod de VF — uniquement si les deux mots de passe
// saisis sont identiques. Sert à VF pour valider sa réception/traitement du payload avant l'intégration.
// Autonome : ne dépend PAS des creds VF (l'URL est fournie par l'opérateur), donc utilisable en démo.

// Garde-fou SSRF (A10) : l'URL cible est saisie librement par un membre interne. On exige https + on
// rejette les hôtes internes/loopback/link-local/privés — un webhook de test ne vise qu'un hôte public.
function isSafeTargetUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (h === "0.0.0.0" || h === "::1" || h.startsWith("[")) return false; // ipv6 / unspecified
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  return true;
}

// Payload d'exemple représentatif (format Route A `VisioformationPayload`) — pas de dépendance data,
// suffit à Joseph pour valider réception + traitement. Objet frais à chaque appel (pas de mutation).
function buildSamplePayload(): VisioformationPayload {
  return {
    meta: { source: "CRM-LCA", event: "adf.formation.push", environment: "preprod", sent_at: new Date().toISOString(), external_reference: "LCA-PLAN-TEST-0001" },
    formation: { titre: "Performance B2B Outbound", mode: "distanciel", lieu: "Distanciel (visioconférence)", vt_prevues: 6, journees_prevues: 3, duree_totale_heures: 10.5, date_debut: "2026-09-01", date_fin: "2026-09-08" },
    entreprise: { raison_sociale: "DIVERSIDEES (TEST)", siret: "52474839900012", adresse: "70 RUE JEAN-PIERRE TIMBAUD", ville: "PARIS" },
    formateur: { nom: "Dupont", prenom: "Alexandre", email: "alexandre@closing-academie.com" },
    sessions: [
      { date: "2026-09-01", type: "VT", heures: 3.5, statut: "planned" },
      { date: "2026-09-08", type: "journee", heures: 7, statut: "planned" },
    ],
    apprenants: [
      { nom: "Chemouny", prenom: "Yohanna", email: "yohanna@diversidees.fr", telephone: "0612345678", fonction: "Dirigeante" },
    ],
  };
}

export async function POST(req: Request) {
  const auth = await requireMember();
  if (auth instanceof NextResponse) return auth;

  let body: { targetUrl?: string; password1?: string; password2?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }

  const targetUrl = (body.targetUrl ?? "").trim();
  const p1 = body.password1 ?? "";
  const p2 = body.password2 ?? "";

  if (!targetUrl) return NextResponse.json({ error: "URL de destination requise." }, { status: 400 });
  if (!isSafeTargetUrl(targetUrl)) return NextResponse.json({ error: "URL invalide : https requis, hôtes internes interdits." }, { status: 400 });
  if (!p1 || p1 !== p2) return NextResponse.json({ error: "Les deux mots de passe doivent être identiques (et non vides)." }, { status: 400 });

  const payload = buildSamplePayload();

  // Le mot de passe (identique des deux côtés) est transmis en en-tête pour que VF puisse valider
  // l'origine si besoin. ⚠️ Nom d'en-tête PROVISOIRE — à confirmer avec Joseph (simple garde-fou local
  // ou secret d'auth transmis ?).
  let vfStatus = 0;
  let vfBody = "";
  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Test-Secret": p1 },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    vfStatus = res.status;
    vfBody = (await res.text()).slice(0, 2000);
  } catch (e) {
    return NextResponse.json({ error: `Échec de l'envoi : ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }

  return NextResponse.json({
    ok: vfStatus >= 200 && vfStatus < 300,
    status: vfStatus,
    response: vfBody,
    sentPayload: payload,
  });
}
