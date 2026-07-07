<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Déploiement production (Vercel)

L'auto-deploy GitHub → Vercel fonctionne : `git push origin main` déclenche automatiquement un build prod.

Fallback si l'auto-deploy est bloqué : `scripts/deploy-prod.sh` (déploie sans `.git` pour contourner le `seatBlock`).
