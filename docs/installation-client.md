# Installation du CRM pour un nouveau client

Ce document décrit la procédure complète pour déployer le CRM sur un projet
Supabase neuf, à partir du dépôt commun.

---

## Prérequis

- Un compte Supabase (plan Pro recommandé pour les cron jobs)
- Node.js 20+
- Un compte Vercel (pour le déploiement de l'application)
- La CLI Supabase : `npm install -g supabase`

---

## Étape 1 — Créer le projet Supabase

1. Aller sur [app.supabase.com](https://app.supabase.com)
2. Créer un nouveau projet dans l'organisation du client
3. Choisir la région la plus proche du client (ex : `eu-west-3` pour la France)
4. Noter :
   - La **référence du projet** (ex : `abcdefghijklmnopqrst`)
   - Le **mot de passe de la base de données**
   - L'**URL du projet** : `https://<ref>.supabase.co`
   - La **clé anon** (Settings → API → `anon` key)
   - La **clé service_role** (Settings → API → `service_role` key)

---

## Étape 2 — Activer les extensions requises

Dans le dashboard Supabase → Database → Extensions, activer :

| Extension     | Schéma       | Usage                           |
|---------------|--------------|----------------------------------|
| `pg_cron`     | pg_catalog   | Tâches planifiées (nurture)     |
| `pg_net`      | extensions   | Appels HTTP depuis la base       |
| `pgcrypto`    | extensions   | Génération UUID, hachage        |
| `uuid-ossp`   | extensions   | Génération UUID v4               |
| `unaccent`    | extensions   | Recherche sans accents           |

> `pg_stat_statements`, `supabase_vault` et `plpgsql` sont pré-installés.

---

## Étape 3 — Appliquer le schéma

```bash
# Cloner le dépôt
git clone <url-du-repo> crm-client
cd crm-client

# Lier au projet Supabase du client
npx supabase link --project-ref <ref-du-projet> --password '<mot-de-passe-db>'

# Appliquer la migration initiale
npx supabase db push --password '<mot-de-passe-db>'
```

Vérifier dans le dashboard Supabase → Table Editor que les tables sont créées
(~88 tables dans le schéma `public`).

---

## Étape 4 — Insérer les données de référence

```bash
# Depuis la racine du dépôt
npx supabase db seed --password '<mot-de-passe-db>'
```

Cela insère les valeurs par défaut dans les tables de référence :
- Types d'entreprise, sources de leads, types de formation
- Thèmes de session, catégories de dépenses
- Workflows d'automatisation et leurs étapes
- Séquences de nurture

Le client peut ensuite personnaliser ces valeurs depuis l'interface du CRM.

---

## Étape 5 — Configurer les buckets de stockage

Les 10 buckets sont créés automatiquement par le seed. Vérifier dans
Storage qu'ils apparaissent :

| Bucket                      | Public | Usage                        |
|-----------------------------| ------ |------------------------------|
| `avatars`                   | Oui    | Photos de profil             |
| `billing-documents`         | Non    | Documents de facturation     |
| `company-documents`         | Non    | Documents d'entreprise       |
| `deal-documents`            | Non    | Documents liés aux deals     |
| `invoice-documents`         | Non    | Factures                     |
| `marketing-expense-documents`| Non   | Justificatifs marketing      |
| `note-attachments`          | Oui    | Pièces jointes aux notes     |
| `post-attachments`          | Oui    | Pièces jointes aux posts     |
| `public-downloads`          | Oui    | Fichiers en téléchargement   |
| `resources`                 | Non    | Ressources pédagogiques      |

---

## Étape 6 — Configurer l'authentification

Dans le dashboard Supabase → Authentication → Settings :

1. **URL du site** : mettre l'URL de déploiement du client
   (ex : `https://crm-client.vercel.app`)
2. **Redirect URLs** : ajouter :
   - `https://crm-client.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (pour le dev local)
3. **Fournisseurs** : activer Email/Password (activé par défaut)
4. **Templates d'email** : personnaliser les emails de confirmation,
   réinitialisation de mot de passe, etc. avec la marque du client

---

## Étape 7 — Configurer le cron job nurture

Le CRM utilise un cron job `pg_cron` qui appelle l'API nurture toutes les heures.

1. Générer un secret aléatoire pour le cron :
   ```bash
   openssl rand -hex 32
   ```

2. Stocker le secret dans le vault Supabase (SQL Editor) :
   ```sql
   SELECT vault.create_secret('<secret-généré>', 'nurture_cron_secret');
   ```

3. Créer le cron job (SQL Editor) :
   ```sql
   SELECT cron.schedule(
     'nurture-hourly',
     '0 * * * *',
     $$
     SELECT net.http_get(
       url := 'https://<url-du-client>/api/cron/nurture',
       headers := jsonb_build_object(
         'Authorization',
         'Bearer ' || (
           SELECT decrypted_secret
           FROM vault.decrypted_secrets
           WHERE name = 'nurture_cron_secret'
         )
       )
     );
     $$
   );
   ```

4. Ajouter la variable d'environnement `CRON_SECRET=<secret-généré>` dans
   les variables Vercel du projet.

---

## Étape 8 — Déployer l'application sur Vercel

1. Créer un nouveau projet Vercel lié au dépôt Git
2. Configurer les variables d'environnement :

| Variable                           | Valeur                                      |
|------------------------------------|---------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`         | `https://<ref>.supabase.co`                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Clé anon du projet                          |
| `SUPABASE_SERVICE_ROLE_KEY`        | Clé service_role du projet                  |
| `CRON_SECRET`                      | Secret généré à l'étape 7                   |

3. Déclencher le premier déploiement

---

## Étape 9 — Vérification

Parcours de test à effectuer après le déploiement :

1. [ ] Ouvrir l'URL du CRM → la page de connexion s'affiche
2. [ ] Créer un compte utilisateur (email + mot de passe)
3. [ ] Se connecter → le dashboard s'affiche sans erreur
4. [ ] Créer un membre d'équipe (paramètres)
5. [ ] Créer une entreprise
6. [ ] Créer un contact rattaché à l'entreprise
7. [ ] Créer une opportunité
8. [ ] Téléverser un document sur un deal
9. [ ] Vérifier : aucune erreur dans la console du navigateur
10. [ ] Vérifier : les données apparaissent dans le dashboard Supabase

---

## Éléments hors-schéma — Inventaire

Ces éléments ne sont pas inclus dans la migration SQL et doivent être
configurés manuellement pour chaque client :

### 1. Tâche planifiée (cron job)
- **Quoi** : appel HTTP vers `/api/cron/nurture` toutes les heures
- **Action** : voir étape 7 ci-dessus
- **Prérequis** : plan Supabase Pro (pg_cron non dispo en Free)

### 2. Configuration de l'authentification
- **Quoi** : URL du site, URLs de redirection, templates d'email
- **Action** : voir étape 6 ci-dessus
- **Note** : les templates par défaut de Supabase fonctionnent, mais doivent
  être personnalisés avec la marque du client

### 3. Extensions PostgreSQL
- **Quoi** : `pg_cron`, `pg_net`, `pgcrypto`, `uuid-ossp`, `unaccent`
- **Action** : voir étape 2 ci-dessus
- **Note** : `pgcrypto`, `uuid-ossp` et `unaccent` sont créés par la
  migration si les extensions sont activées. `pg_cron` et `pg_net` doivent
  être activés manuellement via le dashboard.

### 4. Compteur de numérotation des devis
- **Quoi** : table `quote_sequences` avec `last_number = 0`
- **Action** : le seed insère automatiquement la ligne avec `last_number = 0`.
  Chaque nouveau client repart de zéro.
- **Note** : ne PAS copier la valeur de LCA

### 5. Secret vault pour le cron
- **Quoi** : `nurture_cron_secret` dans `vault.decrypted_secrets`
- **Action** : voir étape 7

### 6. Variables d'environnement Vercel
- **Quoi** : connexion Supabase, secrets API
- **Action** : voir étape 9

### 7. Edge Functions
- **Quoi** : aucune Edge Function déployée actuellement
- **Action** : rien à faire
