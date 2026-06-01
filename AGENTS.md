<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Déploiement production (Vercel)

Déployer la prod **uniquement** via `scripts/deploy-prod.sh` (depuis la racine du repo) :

```bash
scripts/deploy-prod.sh          # confirme avant de pousser
scripts/deploy-prod.sh --yes    # sans confirmation
```

`vercel --prod` direct et l'auto-deploy GitHub→Vercel sont **cassés** : le compte Vercel
bloque tout déploiement dont l'auteur git n'a pas de siège sur le compte
(`seatBlock = TEAM_ACCESS_REQUIRED` → `readyState=BLOCKED`, jamais construit). Le script
contourne en déployant depuis un arbre sans `.git` (`git archive origin/main`) avec le token
de Loïc → build attribué au propriétaire du token. Détail + garde-fous : header du script et
`closing-academy/.claude/rules/deploy-prod-crm.md`.

Après un merge sur `main`, la prod n'est **pas** mise à jour automatiquement — lancer le script.
