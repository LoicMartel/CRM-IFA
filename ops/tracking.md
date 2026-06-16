---
nom: CRM-LCA
client: La Closing Académie (CRM custom — Rafi & Naznine, Loïc)
via: LDG / La Dinguerie (Younes/Balla)
phase: Prod live (ADV/CRM), inbox en attente activation
avancement: 85%
bloquant: Unipile ré-activé 15/06 (accès API restauré) ; inbox attend connexion boîtes réelles (contact@ leads / boîte Rafi gated RGPD) + visio cadrage dispatch
next: Animer visio cadrage tri/dispatch
group: build
last-update: 2026-06-16
next-review: 2026-07-01
---

# CRM-LCA — Tracking

## Statut
CRM sur mesure (Next.js 16 + Supabase, déployé `crm-lca.vercel.app`) pour La Closing Académie. Module ADV/CRM (commercial + production + facturation Pennylane) live en prod. Module inbox (agent leads + copilote + tri/dispatch courrier) buildé, gates verts, en attente d'activation client.

> **Même client que `closing-academy`** (`ldg-hub/projets/closing-academy.md`). `closing-academy` porte le pilotage + la liste complète des bloquants/inputs client (`ops/bloquants-client.md`, `ops/state.md`). Ici = état technique du CRM.

## Bloquant actuel
Abo Unipile ré-activé le 15/06 (accès API restauré, cf `closing-academy/ops/state.md`) — verrou n°1 levé. L'activation de l'inbox attend la connexion des vraies boîtes (contact@ leads = actionnable / boîte pro Rafi = gated RGPD écrit) + une visio de cadrage Rafi + Loïc (mapping destinataires, seuil lead, autonomie).

<!-- INPUTS:START -->
## Inputs clients en attente
| # | Input attendu | Qui | Depuis | Relancé le | Débloque |
|---|---------------|-----|--------|-----------|----------|
| 1 | (Bloquants client partagés) — voir `closing-academy` : Unipile, IMAP Ionos, RGPD, dispatch, LGM Pauline, ADF | Rafi / Naznine / Loïc / Pauline | — | — | Activation inbox + prospection |
| 2 | Échantillon messages de Rafi (sa voix) + 100-500 mails boîte Ionos | Rafi / Loïc | — | — | Voix du copilote + calibrage tri |
<!-- INPUTS:END -->

## Prochaine action (Teina)
- [ ] Animer la visio de cadrage tri/dispatch (trame : `docs/WF-001/trame-visio-cadrage-tri-dispatch-20260612.md`).
- [ ] Dès Unipile renouvelé : cutover inbox (migrations → merge → comptes agent/classify → `deploy-prod.sh` → E2E). Vercel Pro requis au go-live.

## Détail
> Source de vérité partagée : `~/projects/closing-academy/ops/state.md` + `ops/bloquants-client.md`. Perf : `ops/perf-baseline.md`.
