/**
 * Wraps delete confirmation: if the user is a restricted externe,
 * shows a "contact admin" message instead of proceeding.
 */
export function confirmDelete(
  isRestrictedOrReadOnly: boolean,
  message: string = "Supprimer ? Cette action est irréversible."
): boolean {
  if (isRestrictedOrReadOnly) {
    alert("Vous n'avez pas les droits pour supprimer cet élément. Veuillez contacter l'administrateur pour valider la suppression.");
    return false;
  }
  return window.confirm(message);
}
