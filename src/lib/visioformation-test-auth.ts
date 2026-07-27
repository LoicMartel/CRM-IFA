// En-tête d'authentification du bouton de test VisioFormation.
//
// Joseph (VisioFormation) développe son endpoint de réception en ce moment — le nom de l'en-tête et le
// format du secret sont SON choix, et il les annoncera au moment de nous donner l'URL. On les rend
// saisissables dans l'UI plutôt que de dépendre d'un redéploiement en pleine visio : `X-Test-Secret`
// n'était qu'un nom provisoire de notre côté, et la Route A réelle, elle, envoie `Authorization: Bearer`.

export const DEFAULT_TEST_AUTH_HEADER = "X-Test-Secret";

// Un nom d'en-tête HTTP est un token RFC 7230 : ni espace, ni ':', ni caractère de contrôle.
const HEADER_NAME_RE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

export type TestAuthHeader =
  | { ok: true; name: string; value: string }
  | { ok: false; error: string };

export function buildTestAuthHeader(input: {
  headerName?: string | null;
  secret: string;
  bearerPrefix?: boolean;
}): TestAuthHeader {
  const name = (input.headerName ?? "").trim() || DEFAULT_TEST_AUTH_HEADER;
  if (!HEADER_NAME_RE.test(name)) {
    return { ok: false, error: `Nom d'en-tête invalide : "${name}" (lettres, chiffres et - _ . uniquement).` };
  }
  // Un secret multi-ligne permettrait d'injecter d'autres en-têtes dans la requête sortante.
  if (/[\r\n]/.test(input.secret)) {
    return { ok: false, error: "Le secret ne peut pas contenir de retour à la ligne." };
  }
  return { ok: true, name, value: input.bearerPrefix ? `Bearer ${input.secret}` : input.secret };
}
