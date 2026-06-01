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

## APRÈS (région cdg1) — <date> (Task 4)
| Endpoint | TTFB warm (médian) | total | Δ |
|---|---|---|---|
| /api/webhooks/firma (405) | | | |
| /login | | | |
| / | | | |

Vérif région post-deploy attendue : `x-vercel-id` de `/api/webhooks/firma` doit passer de `cdg1::iad1::…` à `cdg1::…` (plus de saut iad1).

## Speed Insights (Web Vitals utilisateurs FR réels)
- Avant : hasData false. Après : TTFB/LCP/INP relevés dans Vercel → <noter>.

## GATE (Task 4)
- Critère succès : TTFB du proxy fonction (`/api/webhooks/firma` warm) **÷ ~2-3** + disparition du `::iad1::` dans `x-vercel-id`.
- Conclusion : <le fix région suffit-il / Phase 3 caching justifiée ?>
