/**
 * Résolution du bénéficiaire pour les pièces ADV (devis + convention).
 *
 * Une entreprise peut porter plusieurs raisons sociales (entités juridiques). Quand le
 * deal en désigne une, c'est elle qui figure sur le document (nom, SIRET, adresse,
 * apprenants rattachés) ; sinon on retombe sur les infos de base de l'entreprise.
 *
 * Le résolveur est serveur-only : l'UI n'envoie qu'un id, jamais un SIRET ou une adresse.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Beneficiary {
  /** Entité retenue, ou null si on est retombé sur l'entreprise. */
  raisonSocialeId: string | null;
  name: string | null;
  siret: string | null;
  address: string | null;
  city: string | null;
  /** Participants rattachés, format liste d'émargement ("NOM Prénom"). */
  learnerNames: string[];
}

export interface RaisonSocialeOption {
  id: string;
  name: string;
  siret: string | null;
  address: string | null;
  learnerNames: string[];
}

type LearnerRow = { first_name: string | null; last_name: string | null };

function learnerName(l: LearnerRow): string {
  return [l.last_name, l.first_name].map((p) => p?.trim()).filter(Boolean).join(" ");
}

function sortNames(names: string[]): string[] {
  return names.filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
}

/**
 * Noms des apprenants rattachés, par raison sociale.
 * Deux requêtes explicites plutôt qu'un embed imbriqué : la forme du résultat
 * (objet vs tableau) ne dépend pas de l'inférence PostgREST.
 */
async function namesByRaisonSociale(
  serviceClient: SupabaseClient,
  raisonSocialeIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(raisonSocialeIds.map((id) => [id, []]));
  if (raisonSocialeIds.length === 0) return out;

  const { data: links } = await serviceClient
    .from("raison_sociale_learners")
    .select("raison_sociale_id, learner_id")
    .in("raison_sociale_id", raisonSocialeIds);
  const learnerIds = [...new Set((links ?? []).map((l) => l.learner_id))];
  if (learnerIds.length === 0) return out;

  const { data: learners } = await serviceClient
    .from("learners")
    .select("id, first_name, last_name")
    .in("id", learnerIds);
  const nameById = new Map((learners ?? []).map((l) => [l.id, learnerName(l)]));

  for (const link of links ?? []) {
    const name = nameById.get(link.learner_id);
    if (name) out.get(link.raison_sociale_id)?.push(name);
  }
  for (const [id, names] of out) out.set(id, sortNames(names));
  return out;
}

/**
 * Résout le bénéficiaire d'un deal.
 *
 * `raisonSocialeId` est ignoré s'il ne pointe pas vers une entité de `companyId` — un id
 * venu du client ne peut donc pas faire fuiter l'entité d'une autre entreprise.
 * Chaque champ non renseigné sur l'entité retombe sur celui de l'entreprise, pour ne
 * jamais produire un document au SIRET ou à l'adresse vides.
 */
export async function resolveBeneficiary(
  serviceClient: SupabaseClient,
  companyId: string | null,
  raisonSocialeId: string | null | undefined,
): Promise<Beneficiary | null> {
  if (!companyId) return null;

  const { data: company } = await serviceClient
    .from("companies")
    .select("id, name, siret, address, city")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return null;

  if (raisonSocialeId) {
    const { data: rs } = await serviceClient
      .from("company_raisons_sociales")
      .select("id, name, siret, address")
      .eq("id", raisonSocialeId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (rs) {
      const names = await namesByRaisonSociale(serviceClient, [rs.id]);
      return {
        raisonSocialeId: rs.id,
        name: rs.name?.trim() || company.name,
        siret: rs.siret?.trim() || company.siret,
        address: rs.address?.trim() || company.address,
        // L'adresse de l'entité est un champ unique : pas de ville à concaténer.
        city: rs.address?.trim() ? null : company.city,
        learnerNames: names.get(rs.id) ?? [],
      };
    }
  }

  const { data: learners } = await serviceClient
    .from("learners")
    .select("first_name, last_name")
    .eq("company_id", companyId);
  return {
    raisonSocialeId: null,
    name: company.name,
    siret: company.siret,
    address: company.address,
    city: company.city,
    learnerNames: sortNames((learners ?? []).map(learnerName)),
  };
}

/** Liste les entités d'une entreprise (alimente les sélecteurs devis + convention). */
export async function listCompanyRaisonsSociales(
  serviceClient: SupabaseClient,
  companyId: string,
): Promise<RaisonSocialeOption[]> {
  const { data } = await serviceClient
    .from("company_raisons_sociales")
    .select("id, name, siret, address")
    .eq("company_id", companyId)
    .order("name");
  const rows = data ?? [];
  const names = await namesByRaisonSociale(serviceClient, rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    siret: r.siret,
    address: r.address,
    learnerNames: names.get(r.id) ?? [],
  }));
}
