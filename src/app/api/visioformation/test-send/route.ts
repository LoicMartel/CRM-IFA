import { NextResponse } from "next/server";
import { requireMember } from "@/lib/api-auth";
import type { VisioformationPayload } from "@/lib/visioformation-client";
import { buildTestAuthHeader } from "@/lib/visioformation-test-auth";

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
//
// ⚠️ Les VALEURS reproduisent celles de la prod (relevé base 28/07, 839 créneaux / 67 formations) —
// un exemple "trop parfait" ferait valider à VF un cas qui n'existe pas, et son parsing casserait au
// 1er vrai push :
//   - `type` en MINUSCULES : "vt" (627) | "journee" (212) — jamais "VT".
//   - `statut` : "done" (650) | "planned" (112) | "cancelled" (72) | "no_show" (5).
//   - `lieu` : null sur les VT (forcé côté CRM), renseigné sur les journées (obligatoire depuis 3e06a57)
//     — historiquement vide sur 808 créneaux/839, donc VF DOIT accepter null.
//   - `mode` sans accent : "presentiel" | "distanciel" | "mixte".
//   - `formation.lieu` = 1er lieu non vide des créneaux (règle de buildFormationPayload).
//   - `duree_totale_heures` = somme des heures des créneaux ; `date_debut`/`date_fin` = min/max des dates.
// Peuvent aussi arriver à null en prod, et ne sont donc PAS des champs garantis : `formateur` (objet
// entier, si aucun formateur affecté), `siret`, `telephone`, `fonction`.
function buildSamplePayload(): VisioformationPayload {
  return {
    meta: { source: "CRM-LCA", event: "adf.formation.push", environment: "preprod", sent_at: new Date().toISOString(), external_reference: "LCA-PLAN-TEST-0001" },
    formation: { titre: "Performance B2B Outbound", mode: "mixte", lieu: "Paris — 70 rue Jean-Pierre Timbaud", vt_prevues: 6, journees_prevues: 3, duree_totale_heures: 14, date_debut: "2026-08-25", date_fin: "2026-09-08" },
    entreprise: { raison_sociale: "DIVERSIDEES (TEST)", siret: "52474839900012", adresse: "70 RUE JEAN-PIERRE TIMBAUD", ville: "PARIS" },
    formateur: { nom: "Dupont", prenom: "Alexandre", email: "alexandre@closing-academie.com" },
    // VT sans lieu (le CRM le force à null) + journée localisée : lieu PAR créneau, multi-sites
    // possible (Iman 13/07). Un créneau déjà passé porte "done" — VF reçoit des statuts mêlés.
    sessions: [
      { date: "2026-08-25", type: "vt", heures: 3.5, statut: "done", lieu: null },
      { date: "2026-09-01", type: "vt", heures: 3.5, statut: "planned", lieu: null },
      { date: "2026-09-08", type: "journee", heures: 7, statut: "planned", lieu: "Paris — 70 rue Jean-Pierre Timbaud" },
    ],
    // 2e apprenant volontairement incomplet (telephone/fonction non saisis) : cas courant en base.
    apprenants: [
      { nom: "Chemouny", prenom: "Yohanna", email: "yohanna@diversidees.fr", telephone: "0612345678", fonction: "Dirigeante" },
      { nom: "Martin", prenom: "Claire", email: "claire.martin@diversidees.fr", telephone: null, fonction: null },
    ],
  };
}

export async function POST(req: Request) {
  const auth = await requireMember();
  if (auth instanceof NextResponse) return auth;

  let body: { targetUrl?: string; password1?: string; password2?: string; authHeaderName?: string; bearerPrefix?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }

  const targetUrl = (body.targetUrl ?? "").trim();
  const p1 = body.password1 ?? "";
  const p2 = body.password2 ?? "";

  if (!targetUrl) return NextResponse.json({ error: "URL de destination requise." }, { status: 400 });
  if (!isSafeTargetUrl(targetUrl)) return NextResponse.json({ error: "URL invalide : https requis, hôtes internes interdits." }, { status: 400 });
  if (!p1 || p1 !== p2) return NextResponse.json({ error: "Les deux mots de passe doivent être identiques (et non vides)." }, { status: 400 });

  // Le secret (saisi deux fois, cf. demande de Joseph du 06/07) part en en-tête pour qu'il valide
  // l'origine. Le NOM de l'en-tête est le sien : réglable dans l'UI, pour s'aligner en séance sans
  // redéploiement (cf. visioformation-test-auth.ts).
  const authHeader = buildTestAuthHeader({ headerName: body.authHeaderName, secret: p1, bearerPrefix: body.bearerPrefix });
  if (!authHeader.ok) return NextResponse.json({ error: authHeader.error }, { status: 400 });

  const payload = buildSamplePayload();

  let vfStatus = 0;
  let vfBody = "";
  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", [authHeader.name]: authHeader.value },
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
    // Renvoyé pour que l'opérateur voie, en séance, l'en-tête exact qui est parti (le secret reste masqué).
    sentAuthHeader: `${authHeader.name}: ${body.bearerPrefix ? "Bearer ***" : "***"}`,
  });
}
