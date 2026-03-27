# CRM Closing Académie — Documentation Projet

## 1. Présentation du projet

### Contexte
La **Closing Académie** est un organisme de formation commerciale B2B certifié Qualiopi, présent dans plus de 20 pays et ayant formé plus de 10 000 personnes. L'entreprise propose des programmes de formation en techniques de vente (closing), développement commercial et management commercial.

### Objectif du CRM
Construire un CRM sur mesure couvrant **3 piliers** :
1. **Commercial** — Gestion du pipeline de ventes (leads, opportunités, commandes)
2. **Production** — Planification et suivi de la délivrance des formations
3. **Pilotage financier** — Facturation, trésorerie, charges et KPIs financiers

### Équipe
| Membre | Rôle |
|--------|------|
| Rafi Mouhamad | Fondateur / Admin |
| Loïc Martel | Sales / Account Manager |
| Alexandre Mandereau | Sales |
| Naznine Mouhamad | Account Manager / Référente handicap |
| Guillaume | Trainer |

---

## 2. Architecture technique

### Stack technologique
| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Frontend** | Next.js 16 (App Router) + TypeScript | Application web SSR/SSG |
| **UI** | Tailwind CSS + shadcn/ui | Design system et composants |
| **Backend/BDD** | Supabase (PostgreSQL 17) | Base de données, Auth, API REST |
| **Graphiques** | Recharts | Dashboards et visualisations |
| **Icônes** | Lucide React | Iconographie |
| **Utilitaires** | date-fns, clsx, tailwind-merge | Manipulation de dates et classes CSS |

### Infrastructure
- **Hébergement BDD** : Supabase Cloud (région `eu-west-1`)
- **Projet Supabase** : `CRM LCA` (ID: `gxxxhcqkibojkujssolq`)
- **Auth** : Supabase Auth avec middleware de protection des routes

### Architecture applicative
```
┌─────────────────────────────────────────────┐
│                  Client (Browser)            │
├─────────────────────────────────────────────┤
│        Next.js App Router (SSR/CSR)         │
│  ┌──────────┬──────────┬──────────────────┐ │
│  │ (auth)   │(dashboard)│   API Routes    │ │
│  │  login   │ leads     │                 │ │
│  │          │ opps      │                 │ │
│  │          │ orders    │                 │ │
│  │          │ clients   │                 │ │
│  │          │ planning  │                 │ │
│  │          │ delivery  │                 │ │
│  │          │ invoices  │                 │ │
│  │          │ finances  │                 │ │
│  │          │ team      │                 │ │
│  └──────────┴──────────┴──────────────────┘ │
├─────────────────────────────────────────────┤
│           Supabase Client (SSR/CSR)         │
├─────────────────────────────────────────────┤
│     Supabase (PostgreSQL + Auth + REST)     │
└─────────────────────────────────────────────┘
```

---

## 3. Schéma de base de données

### Vue d'ensemble (18 tables)

```
┌─────────────────────────────────────────────────────────────┐
│                      RÉFÉRENTIELS                           │
│  company_types │ lead_sources │ training_programs            │
│  training_types │ session_themes │ expense_categories        │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  MODULE COMMERCIAL│ │ MODULE PRODUCTION │ │ MODULE FINANCIER │
│                  │ │                  │ │                  │
│  team_members    │ │  learners        │ │  invoices        │
│  companies       │ │  service_plans   │ │  monthly_finances│
│  contacts        │ │  service_plan_   │ │  expenses        │
│  leads           │ │    learners      │ │  sales_targets   │
│  opportunities   │ │  sessions        │ │                  │
│  orders          │ │                  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │   TRANSVERSAL    │
                    │   activities     │
                    └──────────────────┘
```

### Détail des tables

#### Référentiels
| Table | Description | Champs clés |
|-------|-------------|-------------|
| `company_types` | Types d'entreprise | name |
| `lead_sources` | Sources de leads | name |
| `training_programs` | Parcours de formation | name, description |
| `training_types` | Types de formation | name (BtoB, BtoC, Mixte) |
| `session_themes` | Thèmes de sessions | name, is_billable, delivery_mode, default_hours, default_rate |
| `expense_categories` | Catégories de charges | name, parent_category |

#### Module Commercial
| Table | Description | Champs clés |
|-------|-------------|-------------|
| `team_members` | Équipe | first_name, last_name, email, role (admin/sales/trainer/account_manager/finance) |
| `companies` | Entreprises clientes | name, company_type_id, phone, email, city |
| `contacts` | Contacts/Prospects | first_name, last_name, company_id, is_client |
| `leads` | Pipeline commercial | contact_id, sales_id, source_id, r1/r2/r3/r3_2_status, status (nouveau→gagné/perdu) |
| `opportunities` | Opportunités & Pipe | name, company_id, sales_id, amount, training_days, stage |
| `orders` | Prises de Commandes (PDCO) | client_name, account_manager_id, order_date, amount, training_days, is_invoiced |

#### Module Production
| Table | Description | Champs clés |
|-------|-------------|-------------|
| `learners` | Apprenants | first_name, last_name, company_id, status (ancien/actuel/futur), program_id |
| `service_plans` | Plans de service | company_id, program_id, budget, start_date, end_date |
| `service_plan_learners` | Lien plan ↔ apprenants | service_plan_id, learner_id |
| `sessions` | Sessions délivrées | session_date, company_id, theme_id, hours_planned/delivered, learners_planned/delivered, billable_amount |

#### Module Financier
| Table | Description | Champs clés |
|-------|-------------|-------------|
| `invoices` | Factures | company_id, client_name, funding_type (UP FRONT/OPCO/CPF), month, amount, is_paid |
| `monthly_finances` | Dashboard financier | month, orders_target/actual, invoiced, collected, treasury, cash_flow |
| `expenses` | Charges | category_id, tool_name, department, month, amount |
| `sales_targets` | Objectifs de vente | month, target_amount, actual_amount |

#### Transversal
| Table | Description | Champs clés |
|-------|-------------|-------------|
| `activities` | Activités & Notes | type (appel/email/réunion/note/tâche/relance), title, due_date, team_member_id, liens vers contact/company/lead/opportunity/order |

### Relations clés
- `leads` → `contacts`, `companies`, `team_members`, `lead_sources`
- `opportunities` → `contacts`, `companies`, `team_members`
- `orders` → `companies`, `contacts`, `team_members`, `lead_sources`
- `sessions` → `companies`, `session_themes`, `team_members`
- `learners` → `companies`, `training_programs`, `training_types`
- `invoices` → `companies`, `orders`
- `activities` → `team_members`, `contacts`, `companies`, `leads`, `opportunities`, `orders`

---

## 4. Structure de l'application

```
crm-closing-academie/
├── docs/
│   └── DOCUMENTATION.md          # Ce fichier
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx    # Page de connexion
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx        # Layout avec sidebar
│   │   │   ├── page.tsx          # Dashboard principal
│   │   │   ├── leads/            # Gestion des leads
│   │   │   ├── opportunities/    # Opportunités & Pipe
│   │   │   ├── orders/           # Commandes (PDCO)
│   │   │   ├── clients/          # Entreprises & Contacts
│   │   │   ├── planning/         # Planification service
│   │   │   ├── delivery/         # Sessions délivrées
│   │   │   ├── invoices/         # Facturation
│   │   │   ├── finances/         # Dashboard financier
│   │   │   └── team/             # Gestion d'équipe
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                   # Composants shadcn/ui (16 composants)
│   │   ├── layout/               # Sidebar, Header
│   │   ├── dashboard/            # Widgets dashboard
│   │   ├── commercial/           # Composants commerciaux
│   │   ├── production/           # Composants production
│   │   └── finance/              # Composants financiers
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # Client Supabase (browser)
│   │   │   ├── server.ts         # Client Supabase (server)
│   │   │   └── middleware.ts     # Auth middleware
│   │   └── utils.ts              # Utilitaires (cn)
│   ├── types/
│   │   └── database.ts           # Types TypeScript complets
│   ├── hooks/
│   │   └── use-mobile.ts         # Hook détection mobile
│   └── middleware.ts              # Next.js middleware (auth)
├── .env.local                     # Variables d'environnement
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

---

## 5. Modules fonctionnels

### 5.1 Module Commercial

#### Pipeline de leads
Reproduit le flux de votre feuille Excel "Leads" :
- **Étapes** : R1 → R2 → R3 → R3_2 → Suivi
- **Statuts** : Nouveau → En cours → R+ Booked → Gagné / Perdu
- **Données** : Prospect, Entreprise, Type, Mois/Année, Sales, Source
- **KPIs** : Taux de conversion par étape, par source, par commercial

#### Opportunités & Pipe
Reproduit la feuille "OpportunitésPipe" :
- **Opportunités** : Deals potentiels avec montant et jours de formation
- **Pipe** : Devis/conventions envoyés en cours
- **KPIs** : Cumulé Opportunités €, Cumulé Pipe €, Cumulé jours

#### Prises de Commandes (PDCO)
Reproduit la feuille "PDCO" :
- Suivi des commandes signées
- Account Manager assigné
- Source (Prospection, Parrainage, Renouvellement)
- Montant et jours de formation
- Statut de facturation

### 5.2 Module Production

#### Planification Service
Reproduit la feuille "Planification Service" :
- **Clients** avec gérant (nom, tel, email)
- **Apprenants** avec détails (poste, statut ancien/actuel/futur)
- **Formation** : parcours, type, budget prévu/restant
- **Planning** : dates de début/fin, sessions planifiées

#### Delivery (Sessions délivrées)
Reproduit la feuille "Delivery" :
- Suivi semaine par semaine
- Date, client, thème, mode (présentiel/distanciel)
- Heures prévues vs délivrées
- Apprenants prévus vs délivrés
- Montant facturable vs non facturable
- Taux horaire (défaut : 250€/h)

### 5.3 Module Financier

#### Facturation
Reproduit la feuille "Facturation" :
- Facturation par client et par mois
- Type de financement (UP FRONT, OPCO, CPF)
- Suivi paiement (facturé/payé)

#### Dashboard Financier
Reproduit la feuille "Finances" :
- **Commandes** : objectif vs réalisé
- **Délivré** : montant des formations délivrées
- **Facturable** : par delivery et par ADV
- **Facturé / Encaissé** : suivi des paiements
- **Charges** : décaissements, remboursement emprunt
- **Trésorerie** : flux et position de trésorerie
- **Cash Management** : ratio de gestion

#### Charges
Reproduit la feuille "Charges" :
- Par catégorie (RH, Outils admin/vente/marketing/pédagogiques)
- Par outil (Ionos, Webflow, Système.io, Genially, etc.)
- Suivi mensuel

---

## 6. Rôles et permissions

| Rôle | Accès |
|------|-------|
| **Admin** | Accès complet à tous les modules, gestion d'équipe, configuration |
| **Sales** | Module commercial complet, lecture production et finances |
| **Trainer** | Module production (planification, delivery), lecture commercial |
| **Account Manager** | Commercial + Production, suivi clients |
| **Finance** | Module financier complet, lecture commercial et production |

L'authentification est gérée par **Supabase Auth** avec un middleware Next.js qui protège toutes les routes sauf `/login`.

---

## 7. Roadmap / Phases de développement

### Phase 1 — Fondations ✅
- [x] Schéma de base de données (18 tables + index + triggers)
- [x] Données de référence (types, sources, parcours, thèmes, équipe)
- [x] Projet Next.js + TypeScript + Tailwind + shadcn/ui
- [x] Auth Supabase + middleware de protection
- [x] Layout avec sidebar (Commercial / Production / Finance / Admin)
- [x] Dashboard principal avec KPIs
- [x] Page de login
- [x] Types TypeScript complets

### Phase 2 — Module Commercial
- [ ] Page Leads avec tableau, filtres, et pipeline visuel
- [ ] Page Opportunités avec vue Kanban (Opportunité → Pipe → Gagné)
- [ ] Page Commandes (PDCO) avec suivi facturation
- [ ] Page Clients (entreprises + contacts)
- [ ] Synthèse Sales (objectifs vs réalisé)
- [ ] Import des données existantes depuis Excel

### Phase 3 — Module Production
- [ ] Page Planification Service (clients, apprenants, formations)
- [ ] Page Delivery (sessions, heures, billing)
- [ ] Gestion des apprenants
- [ ] Statistiques planification
- [ ] KPIs pédagogie

### Phase 4 — Module Financier
- [ ] Page Facturation (par client, par mois)
- [ ] Dashboard Finances (commandes, facturé, encaissé, trésorerie)
- [ ] Page Charges (par catégorie, par outil)
- [ ] Objectifs de vente

### Phase 5 — Dashboards & KPIs
- [ ] Synthèse Sales avec graphiques Recharts
- [ ] Synthèse Service (portefeuille par trainer, jours délivrés)
- [ ] Récap LMS
- [ ] Dashboard financier avancé avec graphiques
- [ ] Export PDF/Excel

---

## 8. Guide d'installation

### Prérequis
- Node.js >= 18
- npm
- Un projet Supabase configuré

### Installation
```bash
# Cloner le projet
cd /chemin/vers/crm-closing-academie

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.local.example .env.local
# Éditer .env.local avec vos clés Supabase

# Lancer en développement
npm run dev
```

### Commandes utiles
```bash
npm run dev       # Serveur de développement (http://localhost:3000)
npm run build     # Build de production
npm run start     # Serveur de production
npm run lint      # Vérification ESLint
```

---

## 9. Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique (anon) Supabase | `eyJhbGciOiJIUzI1NiIs...` |

> **Note** : Le fichier `.env.local` ne doit jamais être commité dans git. Il contient des clés sensibles.

---

## 10. Données de référence pré-configurées

### Types d'entreprise
Cabinet de conseil, Organisme de formation, PME, ETI, Startup, Grand Groupe, Franchise, Indépendant, Association, École / Université

### Sources de leads
Prospection, Parrainage, Renouvellement, Inbound, Événement, LinkedIn, Site web, Réseau

### Parcours de formation
| Parcours | Description |
|----------|-------------|
| Impulsion | Programme de démarrage commercial intensif |
| Performance | Programme avancé de performance commerciale |
| Excellence | Programme d'excellence commerciale - niveau expert |
| Sur mesure | Programme personnalisé selon les besoins client |
| Blended | Programme mixte bootcamp + sessions distanciel + e-learning |

### Thèmes de session
**Présentiel** : J1/J2 impulsion, J ten steps, J excellence, J propulsion (B2B), J performance, J inter, J kick off, J Sur mesure, J Formation inter LCA

**Distanciel** : VT 30 MIN, VT 1H, VT 1H30, VT 2H, VT suivi Client, VT Commercial prospect

### Taux horaire par défaut
- **250€/heure** pour toutes les sessions
- **1 journée = 8 heures = 2 000€** (présentiel standard)

---

*Document généré le 19 mars 2026 — CRM Closing Académie v1.0*
