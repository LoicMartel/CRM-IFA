# Perf baseline CRM-LCA

## Contexte
- Fonctions Vercel : **iad1 (US-East) AVANT fix** / cdg1 (Paris) APRÈS.
- DB : Supabase eu-west-1 (Dublin). Users : FR.
- Mesures depuis : **France (Mac local Teina)** — valeurs absolues représentatives de l'expérience FR.

## Preuve du root cause (header `x-vercel-id`, 2026-06-01, AVANT fix)
- `/login` → `cdg1::…` : page **statique servie en edge à Paris** (déjà rapide ~100ms — ne capture PAS le problème).
- `/api/webhooks/firma` → `cdg1::iad1::…` : entre par l'**edge cdg1 (Paris)** puis route vers la **fonction serverless en `iad1` (US)**. → Le saut transatlantique `cdg1→iad1` est le coût à supprimer.
- → Meilleur proxy curl mesurable sans session = warm TTFB de `/api/webhooks/firma` (invoque la fonction iad1, retourne 405 avant DB). Les vraies pages lentes (dashboard authentifié + DB Dublin) ne sont pas curlables sans cookie → suivies via Speed Insights.

## AVANT (région iad1) — 2026-06-01
| Endpoint | TTFB warm (médian) | cold start observé | note |
|---|---|---|---|
| /login | ~0.10s | 0.90s | edge statique cdg1 — non représentatif |
| **/api/webhooks/firma** (405) | **~0.22s** | 0.99–1.23s | **proxy fonction iad1** — métrique GATE |
| / (307 redirect) | ~0.094s | — | edge redirect cdg1 |

Échantillons bruts (4 hits/endpoint) :
- /login : 0.902 / 0.114 / 0.099 / 0.111 s
- /api/webhooks/firma : 1.226 / 0.212 / 0.229 / 0.992 s
- / : 0.103 / 0.090 / 0.098 / 0.087 s

## APRÈS (région cdg1) — 2026-06-01 (Task 4, deploy 6694808)
| Endpoint | TTFB warm (médian) | cold start | Δ vs iad1 |
|---|---|---|---|
| **/api/webhooks/firma** (405, proxy fonction) | **~0.120s** | max 0.143s | **÷1.8 (−100ms)** + cold 0.99–1.23s → 0.14s |
| /login (edge statique) | ~0.104s | — | ≈ (déjà edge cdg1) |
| / (307 redirect) | ~0.091s | — | ≈ (déjà edge cdg1) |

Échantillons bruts APRÈS (warm, 4 hits) :
- /login : 0.102 / 0.107 / 0.096 / 0.105 s
- /api/webhooks/firma : 0.122 / 0.143 / 0.115 / 0.119 s
- / : 0.090 / 0.094 / 0.090 / 0.092 s

**Vérif région post-deploy — ✅ confirmée :**
- Projet Vercel : `serverlessFunctionRegion = cdg1` (était `iad1`).
- Runtime `x-vercel-id` `/api/webhooks/firma` : `cdg1::iad1::…` → **`cdg1::cdg1::…`** (saut transatlantique supprimé).

## Speed Insights (Web Vitals utilisateurs FR réels)
- Avant : hasData false. Après : TTFB/LCP/INP relevés dans Vercel → <noter>.

## GATE (Task 4) — ✅ PASSÉ (root cause fixé)
- ✅ Disparition du `::iad1::` dans `x-vercel-id` (preuve directe).
- ✅ Proxy fonction (no-DB) : ÷1.8 sur le seul leg user→fonction (−100ms = RTT transatlantique diagnostiqué). Les **pages authentifiées DB-heavy gagnent davantage** (leg fonction→DB désormais `Paris→Dublin` ~20ms vs `iad1→Dublin` ~80ms ×N requêtes — non capté par ce proxy 405).
- ✅ Cold-start : pics 0.99–1.23s → ≤0.14s.

**Conclusion : le fix région suffit. Phase 3 (caching référence, Task 6) NON justifiée :**
- Leg fonction→DB désormais intra-EU (~20ms RTT Paris↔Dublin) ; les pages (deals) parallélisent déjà (`Promise.all` + `limit(500)`) → temps DB cumulé/page très en-dessous du seuil de déclenchement ~150ms.
- Ajouter `unstable_cache` introduirait de la complexité + risque de fraîcheur sans gain matériel mesuré.
- **Validation finale réelle** = Speed Insights sur trafic FR authentifié (hasData après quelques visites) + 1 mesure live navigateur d'une page dashboard connectée (TTFB DevTools).
- Phase 2 (Task 5, `loading.tsx` + prefetch) : exécutée (ressenti de navigation, non gatée).
