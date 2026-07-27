// Adresse du lieu de formation — règle partagée par tous les points d'écriture d'une session.
//
// Une JOURNÉE présentielle doit porter son adresse : c'est elle qui part sur la convocation
// (VisioFormation), dans l'invitation agenda et dans le payload ADF `sessions[].lieu`. Elle diffère
// souvent du siège social de l'entreprise (constat Iman/Loïc 23/07 : les convocations portaient le
// siège au lieu du lieu réel). Une VT est en visio → pas d'adresse (le champ reste null).
//
// Historique : le CRM pré-remplissait ce champ avec l'adresse de l'entreprise, sans jamais l'exiger →
// 26 des 35 journées à venir n'avaient aucun lieu au 27/07. Cette règle ferme la saisie à la source.

export const SESSION_LOCATION_REQUIRED_MESSAGE =
  "Adresse du lieu de formation obligatoire pour une journée : elle part sur les convocations et diffère souvent du siège.";

export function missingSessionLocation(
  sessionType: string | null | undefined,
  location: string | null | undefined,
): boolean {
  return sessionType === "journee" && !(location ?? "").trim();
}
