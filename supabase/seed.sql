-- ==========================================================
-- CRM — Seed data (reference tables)
-- These are default values for a new CRM installation.
-- Customize as needed for each client.
-- Generated: 2026-07-27T13:39:27.165Z
-- ==========================================================

-- Company type labels
INSERT INTO public."company_types" ("id", "name", "created_at") VALUES ('00424d8c-3995-4860-a694-040a41393c89', 'PME', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."company_types" ("id", "name", "created_at") VALUES ('0d2a193b-73f7-4025-97e6-dd7eb7108d46', 'Cabinet de conseil', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."company_types" ("id", "name", "created_at") VALUES ('38765b8c-a8c5-430f-9462-4fb0c561db4f', 'École / Université', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."company_types" ("id", "name", "created_at") VALUES ('67ad91ac-4b30-4875-8308-3f57c3590f2b', 'ETI', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."company_types" ("id", "name", "created_at") VALUES ('ba211bc2-cf37-440f-92e1-dedbec099670', 'Organisme de formation', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."company_types" ("id", "name", "created_at") VALUES ('c12ef467-5ed1-429e-8135-6849dc92f36b', 'Franchise', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."company_types" ("id", "name", "created_at") VALUES ('cfbdf52b-d1a2-4f8e-a452-ff7098b19366', 'Grand Groupe', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."company_types" ("id", "name", "created_at") VALUES ('d1b13236-8b5c-4c52-8783-7301bf1dede8', 'Association', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."company_types" ("id", "name", "created_at") VALUES ('e16b2730-9e6e-41f2-bf4f-1ab2730d8ec2', 'Startup', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."company_types" ("id", "name", "created_at") VALUES ('f1345db9-57d4-4cea-b81d-2d014d8d6d63', 'Indépendant', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;

-- Lead source labels
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('00adf481-9134-4acc-9bd8-416690f98bb0', 'Oliver List', '2026-03-19T18:55:11.087Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('01e86f7b-ba28-4ebf-8015-ff2c8f2957da', 'TikTok', '2026-04-07T11:51:29.255Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('15e8fa54-6540-43e5-902a-3231e1522e44', 'Meta ads - tunnel book', '2026-04-10T08:15:03.314Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('2ab1cf3d-ae98-4289-b5f1-6cdc5db23033', 'LinkedIn', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('59ab5fc4-e4f6-43c4-b327-61a90001ae16', 'Meta ads - tunnel commercial', '2026-04-10T08:15:03.314Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('977f66e3-8d1d-4a2d-a711-29f39d54680d', 'Événement', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('9d42b20d-1a8c-4f0c-89ad-33dd094bf61d', 'Site web', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('b5672b18-9ab3-40a7-aab3-b22e00cdfc8b', 'Prospection', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('c41de175-041e-4a8c-a439-b5ed3661d418', 'Parrainage', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('c98b345e-52d9-405d-8ca7-5d7f6bf2a7dd', 'Instagram', '2026-04-07T11:51:29.255Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('d8fc50d7-1b75-49c2-ba60-54f71faa7354', 'Renouvellement', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('e05e8f03-78df-4adc-8676-144126675a66', 'Facebook', '2026-04-07T11:51:29.255Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lead_sources" ("id", "name", "created_at") VALUES ('f5a754ac-78a0-4ecf-97ef-d7f8e19e1804', 'Réseau', '2026-04-14T10:38:34.468Z') ON CONFLICT DO NOTHING;

-- Training format types
INSERT INTO public."training_types" ("id", "name", "created_at") VALUES ('11bfb4af-2e18-49bf-b151-141a12696ca4', 'Manager Commercial', '2026-03-25T16:52:11.873Z') ON CONFLICT DO NOTHING;
INSERT INTO public."training_types" ("id", "name", "created_at") VALUES ('b2bf544f-11ef-4d61-bbd2-8380b12262a3', 'Commercial Outbound', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."training_types" ("id", "name", "created_at") VALUES ('b9e1a5dc-41f8-4301-a7f7-f4a386d58792', 'Commercial Mixte', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."training_types" ("id", "name", "created_at") VALUES ('be10ded0-ba4e-4363-bf0b-53b77a9fcb46', 'Commercial Inbound', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."training_types" ("id", "name", "created_at") VALUES ('f7080814-d9ec-4ef3-b695-55d035534123', 'Service', '2026-03-25T16:52:11.873Z') ON CONFLICT DO NOTHING;

-- Session theme labels
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('0ba4bcd6-4560-4c99-a429-70b6836688a9', 'VT suivi Client', FALSE, 'distanciel', '1.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('20f0a748-721d-420d-868b-4510a30c89b7', 'J Sur mesure', TRUE, 'présentiel', '8.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('3e2e974a-813c-4267-a5c2-5f8f9f38dd4f', 'VT 1H', TRUE, 'distanciel', '1.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('57a1a110-6a9c-448c-8a70-4d506217c0f7', 'J1 impulsion', TRUE, 'présentiel', '8.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('61f464cf-ebfe-4ef9-95fa-6e0fe52875cd', 'VT 1H30', TRUE, 'distanciel', '1.50', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('6225ba62-f45a-4343-bea5-fba5ac499b9b', 'J Formation inter LCA', FALSE, 'présentiel', '8.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('6fac5e8c-636e-4827-8e0c-72cfb0e01979', 'VT 30 MIN', TRUE, 'distanciel', '0.50', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('73dfc320-d19e-4903-9cd9-c2371946a908', 'VT Commercial prospect', FALSE, 'distanciel', '1.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('8f44ea85-fbb8-4afa-bfc8-2cdbf712c418', 'J kick off', TRUE, 'présentiel', '8.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('910e22f7-c4de-45d6-95b2-b2c9c2581d5f', 'VT 2H', TRUE, 'distanciel', '2.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('9549758f-8e40-46bb-9d83-d54d55f548bd', 'J2 impulsion', TRUE, 'présentiel', '8.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('a90085fe-9967-4761-b97d-18c807f6462e', 'J performance', TRUE, 'présentiel', '8.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('ace42bc1-ae01-47f6-9697-eb344f40d615', 'J excellence', TRUE, 'présentiel', '8.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('bd8a7ab5-5d45-4a48-8b32-972f60b6a2c1', 'J ten steps', TRUE, 'présentiel', '8.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('ebdbf5e0-3a4a-4f4f-b368-24473e1493e7', 'J propulsion (B2B)', TRUE, 'présentiel', '8.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."session_themes" ("id", "name", "is_billable", "delivery_mode", "default_hours", "default_rate", "created_at") VALUES ('f048f554-165f-4aa3-894e-c6418795f3be', 'J inter', TRUE, 'présentiel', '8.00', '250.00', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;

-- Expense category labels
INSERT INTO public."expense_categories" ("id", "name", "parent_category", "created_at") VALUES ('13539211-0cc4-434c-af8a-68f003c9e206', 'Outils pédagogiques', 'Outils', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."expense_categories" ("id", "name", "parent_category", "created_at") VALUES ('14427f70-d057-4f1f-ac73-0e286e5716c9', 'Outils admin', 'Outils', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."expense_categories" ("id", "name", "parent_category", "created_at") VALUES ('a93bf795-9d93-4548-a225-2a67717fb300', 'Outils marketing', 'Outils', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."expense_categories" ("id", "name", "parent_category", "created_at") VALUES ('d939e6d4-b2ce-43f1-86af-e84a319529de', 'Outils vente', 'Outils', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."expense_categories" ("id", "name", "parent_category", "created_at") VALUES ('e245e704-bc89-4096-8407-31fa510abb3d', 'RH', NULL, '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;

-- LMS forum categories
INSERT INTO public."lms_forum_categories" ("id", "name", "slug", "description", "display_order", "step_id", "is_active", "created_at") VALUES ('30dcf130-e1b5-4914-870c-dcfb709db920', 'Témoignages', 'temoignages', 'Partagez vos réussites et expériences', 3, NULL, TRUE, '2026-04-08T14:16:33.157Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lms_forum_categories" ("id", "name", "slug", "description", "display_order", "step_id", "is_active", "created_at") VALUES ('3e42ffb4-bbac-4c08-b54d-2037efd446e1', 'Entraide', 'entraide', 'Posez vos questions et aidez les autres apprenants', 2, NULL, TRUE, '2026-04-08T14:16:33.157Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lms_forum_categories" ("id", "name", "slug", "description", "display_order", "step_id", "is_active", "created_at") VALUES ('c6a44578-c36d-4771-91b3-a1c9354946a9', 'Général', 'general', 'Discussions générales sur la formation', 1, NULL, TRUE, '2026-04-08T14:16:33.157Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lms_forum_categories" ("id", "name", "slug", "description", "display_order", "step_id", "is_active", "created_at") VALUES ('d4eb552d-1fe9-4cce-acdf-d052d50fed03', 'Ressources', 'ressources', 'Partagez des ressources utiles', 4, NULL, TRUE, '2026-04-08T14:16:33.157Z') ON CONFLICT DO NOTHING;

-- Training programs (example data — customize per client)
INSERT INTO public."training_programs" ("id", "name", "description", "created_at") VALUES ('49253375-7a13-4b0a-808d-8df5889bb0c9', 'Performance', 'Programme avancé de performance commerciale', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."training_programs" ("id", "name", "description", "created_at") VALUES ('54ed466c-9234-4a00-83db-10cabaa48fe4', 'Impulsion', 'Programme de démarrage commercial intensif', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."training_programs" ("id", "name", "description", "created_at") VALUES ('ac4a998a-9961-433e-8cac-a3ab6e83516d', 'Sur mesure', 'Programme personnalisé selon les besoins client', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."training_programs" ("id", "name", "description", "created_at") VALUES ('bca47646-f3b9-4414-9163-1ad67f12939d', 'Excellence', 'Programme d''excellence commerciale - niveau expert', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;
INSERT INTO public."training_programs" ("id", "name", "description", "created_at") VALUES ('ce1fbb7e-1dac-47fc-8cac-00b9ec4c5adc', 'Blended', 'Programme mixte bootcamp + sessions distanciel + e-learning', '2026-03-19T17:45:11.885Z') ON CONFLICT DO NOTHING;

-- LMS learning paths (example data — customize per client)
INSERT INTO public."lms_parcours" ("id", "name", "slug", "description", "cover_image_url", "is_active", "display_order", "created_at", "updated_at") VALUES ('2953b8f6-4ed3-4f44-b6b7-aaefa5d32fb2', 'Croissance', 'croissance', 'Méthode de vente dédiée aux activités de consulting sur le marché PME', NULL, TRUE, 1, '2026-04-08T14:16:33.157Z', '2026-04-08T14:16:33.157Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lms_parcours" ("id", "name", "slug", "description", "cover_image_url", "is_active", "display_order", "created_at", "updated_at") VALUES ('866f33c8-4166-46cf-b11c-b3a2f931431a', 'Compétences', 'competences', 'Méthode de vente dédiée aux organismes de formation sur le marché grand public', NULL, TRUE, 2, '2026-04-08T14:16:33.157Z', '2026-04-08T14:16:33.157Z') ON CONFLICT DO NOTHING;
INSERT INTO public."lms_parcours" ("id", "name", "slug", "description", "cover_image_url", "is_active", "display_order", "created_at", "updated_at") VALUES ('8a17a99c-89c9-4f29-8018-7e759a113529', 'Transformation', 'transformation', 'Méthode de vente dédiée aux organismes de formation - parcours transformation', NULL, TRUE, 3, '2026-04-08T14:16:33.157Z', '2026-04-08T14:16:33.157Z') ON CONFLICT DO NOTHING;

-- Automation workflow definitions
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('43cde2d4-5afb-4555-b8d6-9c692129e54e', 'webflow-form', 'Formulaire Webflow', 'Lead capture depuis le formulaire du site Webflow (site vitrine).', 'tunnel_landing', 'Un formulaire est soumis sur le site Webflow', '/api/webhooks/webflow', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('63c9a72e-323e-43dd-8800-17e2e01b343d', 'calendly-webhook', 'Calendly Webhook', 'RDV pris via Calendly, assigne automatiquement a Pauline.', 'prise_de_rdv', 'Un prospect prend RDV sur Calendly (invitee.created)', '/api/webhooks/calendly', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('66100f22-b7ad-4564-9d7e-5fe17292cd9b', 'booking-pauline', 'Booking Pauline', 'Prise de RDV via la booking page Pauline. 15min, telephone uniquement.', 'prise_de_rdv', 'Un prospect remplit le formulaire booking Pauline', '/api/booking-pauline/confirm', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('6967706b-561f-4740-889d-6e98daaa5d07', 'session-notification', 'Pipeline Notifications Session', 'Pipeline centralise de notifications apres planification d''une session : Google Calendar formateurs, Slack, email externe, email apprenants.', 'sessions_formation', 'Une session est planifiee ou mise a jour', '/api/gcal/notify', TRUE, '{}'::jsonb, '2026-04-11T08:56:19.663Z', '2026-04-11T08:56:19.663Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('800f7270-d470-450e-a13e-2d4f4bf1552f', 'session-created', 'Sync Session de Formation', 'Synchronisation calendrier et notifications formateurs a la creation d''une session.', 'sessions_formation', 'Une session de formation est creee dans la planification', '/api/gcal/sync-session', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('829323a8-8c88-4593-9d9d-09a55e1eb850', 'booking-naznine', 'Booking Naznine', 'Prise de RDV via la booking page Naznine. Visio ou telephone.', 'prise_de_rdv', 'Un prospect remplit le formulaire booking Naznine', '/api/booking-naznine/confirm', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('89dbb3a3-74ea-427f-95d1-64ee7f3fc7b6', 'booking-naznine-decouverte', 'Booking Naznine Decouverte', 'Prise de RDV decouverte via la booking page Naznine.', 'prise_de_rdv', 'Un prospect remplit le formulaire booking Naznine (decouverte)', '/api/booking-naznine-decouverte/confirm', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('91730700-24f1-42e5-a574-7083b6946c0d', 'booking-general', 'Booking Général (Alexandre → Loïc → Rafi)', NULL, 'prise_de_rdv', NULL, NULL, TRUE, '{}'::jsonb, '2026-04-14T08:52:34.158Z', '2026-04-14T08:52:34.158Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('9825bbae-717c-4b26-a171-0691c378372a', 'learner-status-sync', 'Sync Statut Apprenants', 'Met a jour le statut des apprenants (futur → actuel → ancien) selon l''avancement des sessions.', 'sessions_formation', 'Le statut d''une session change', '/api/learners/sync-status', TRUE, '{}'::jsonb, '2026-04-11T08:56:19.663Z', '2026-04-11T08:56:19.663Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('9febacfe-ceb7-4861-b6c2-8b55a13f93fe', 'task-reminders', 'Rappels de Taches', 'Rappels Slack quotidiens pour les taches en retard.', 'taches_rappels', 'CRON quotidien (verification automatique)', '/api/tasks/remind', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('a8596f8c-f3c2-41c0-85eb-d4db27b74051', 'booking-generic', 'Booking Page (Rafi/Naznine)', 'Prise de RDV via la page de booking generique. Assignation dynamique a Rafi ou Naznine.', 'prise_de_rdv', 'Un prospect remplit le formulaire de booking', '/api/booking/confirm', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('c7da1286-3180-4407-8055-63e3ec0e6f33', 'session-cancelled', 'Notification Annulation Session', 'Notification Slack quand une session est annulee.', 'sessions_formation', 'Une session passe en statut "cancelled"', '/api/slack/notify-cancelled', TRUE, '{}'::jsonb, '2026-04-11T08:56:19.663Z', '2026-04-11T08:56:19.663Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('d4af754a-942d-481d-91e7-bffaef55b0ca', 'meeting-notification', 'Pipeline Notifications RDV', 'Pipeline centralise de notifications apres creation d''un RDV : Google Calendar, Slack, email prospect, email externe.', 'notifications_rdv', 'Un meeting est cree avec statut "booked"', '/api/meetings/notify', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('d6437b2b-1b05-457f-921d-861110938566', 'session-completed', 'Session Completee → Delivery', 'Enregistrement delivery et calcul des montants facturables quand une session est terminee.', 'sessions_formation', 'Une session passe en statut "done" ou "no_show"', '/api/sessions/sync-delivery', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('dd3e8cbf-c5ef-445e-9647-929a9195fdd3', 'landing-page-lead', 'Lead Landing Page / Tunnel', 'Capture de lead depuis les landing pages, tunnels Meta ads et formulaires embed.', 'tunnel_landing', 'Un prospect remplit un formulaire sur une landing page', '/api/leads/inbound', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_workflows" ("id", "slug", "name", "description", "category", "trigger_description", "api_route", "is_active", "config", "created_at", "updated_at") VALUES ('ef6c63a7-7b3d-43db-9b44-11fe2b0c5030', 'booking-pauline-commercial', 'Booking Pauline Commercial', 'Prise de RDV via la landing page commerciale Pauline. 15min, telephone.', 'prise_de_rdv', 'Un prospect remplit le formulaire booking Pauline (landing page)', '/api/booking-pauline-commercial/confirm', TRUE, '{}'::jsonb, '2026-04-11T08:29:18.523Z', '2026-04-11T08:29:18.523Z') ON CONFLICT DO NOTHING;

-- Automation workflow steps
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('026c1997-0b39-4baa-8df5-1c7d8fda5e6b', '66100f22-b7ad-4564-9d7e-5fe17292cd9b', 'create-meeting', 'Creer meeting R0', 'Type R0, 15min, telephone uniquement', 'data', 3, TRUE, '{"mode":"phone","meeting_type":"R0","duration_minutes":15}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('054bf454-2b19-4981-9224-6d7ccbd9aef7', 'a8596f8c-f3c2-41c0-85eb-d4db27b74051', 'create-update-company', 'Creer/MAJ entreprise', 'Recherche par nom, cree si inexistante avec lifecycle_stage: prospect', 'data', 1, TRUE, '{}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('058ea9a2-9b44-445b-b00d-350e7d1416b8', '829323a8-8c88-4593-9d9d-09a55e1eb850', 'create-update-company', 'Creer/MAJ entreprise', 'Recherche par nom, cree si inexistante', 'data', 1, TRUE, '{}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('0946cf86-349c-4be8-a08e-ad4b6d926a74', 'd6437b2b-1b05-457f-921d-861110938566', 'calculate-billing', 'Calcul facturation', 'Calcule les montants facturables/non-facturables selon le taux horaire', 'data', 2, TRUE, '{}'::jsonb, '2026-04-11T08:29:53.354Z', '2026-04-11T08:29:53.354Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('0d32e054-9d0e-476e-981d-b91eb88e262d', 'd4af754a-942d-481d-91e7-bffaef55b0ca', 'google-calendar', 'Ajouter a Google Calendar', 'Cree un evenement dans le calendrier commercial du membre assigne', 'calendar', 1, TRUE, '{}'::jsonb, '2026-04-11T08:29:53.354Z', '2026-04-11T08:29:53.354Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('193a1ce3-e865-466f-a058-dad8a2ecaaaa', '91730700-24f1-42e5-a574-7083b6946c0d', 'create-update-company', 'Créer/MAJ entreprise', NULL, 'data', 1, TRUE, '{}'::jsonb, '2026-04-14T08:52:34.158Z', '2026-04-14T08:52:34.158Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('1b5736fa-4c5a-4a31-9bd1-61f8da201373', '91730700-24f1-42e5-a574-7083b6946c0d', 'create-update-contact', 'Créer/MAJ contact', NULL, 'data', 2, TRUE, '{}'::jsonb, '2026-04-14T08:52:34.158Z', '2026-04-14T08:52:34.158Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('1c8a3a48-fc39-4511-9e6d-be17a1fb6601', 'a8596f8c-f3c2-41c0-85eb-d4db27b74051', 'trigger-notifications', 'Declencher notifications', 'Appel au pipeline /api/meetings/notify', 'notification', 4, TRUE, '{}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('1cd5f033-0826-4912-9783-54050a2dae38', 'dd3e8cbf-c5ef-445e-9647-929a9195fdd3', 'notify-rafi', 'Email notification Rafi', 'Envoie un email a Rafi pour signaler le nouveau lead', 'email', 4, TRUE, '{"recipient":"rafi@closing-academie.com","recipient_name":"Rafi"}'::jsonb, '2026-04-11T08:30:09.199Z', '2026-04-11T08:30:09.199Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('26bd8593-6b2c-42f4-ae7e-769bc880578d', '6967706b-561f-4740-889d-6e98daaa5d07', 'slack-dm-trainers', 'Notification Slack formateurs', 'Envoie un DM Slack a chaque formateur avec les details de la session', 'notification', 2, TRUE, '{}'::jsonb, '2026-04-11T08:56:19.663Z', '2026-04-11T08:56:19.663Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('2890be1a-5d45-4635-aba1-5ddbee22bdd6', '63c9a72e-323e-43dd-8800-17e2e01b343d', 'create-meeting', 'Creer meeting R0', 'Type R0, duree selon Calendly, mode visio', 'data', 2, TRUE, '{"mode":"visio","meeting_type":"R0"}'::jsonb, '2026-04-11T08:29:53.354Z', '2026-04-11T08:29:53.354Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('336b4949-8efa-402e-8f4a-ce0b2d8232c8', '9825bbae-717c-4b26-a171-0691c378372a', 'update-learner-status', 'MAJ statut apprenant', 'Passe futur → actuel quand le plan demarre, actuel → ancien quand toutes les sessions sont terminees', 'data', 1, TRUE, '{}'::jsonb, '2026-04-11T08:56:19.663Z', '2026-04-11T08:56:19.663Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('37d44ee6-1ab8-4591-a125-a131a267c51d', '63c9a72e-323e-43dd-8800-17e2e01b343d', 'create-update-contact', 'Creer/MAJ contact', 'Statut: booked, assigne a Pauline', 'data', 1, TRUE, '{"assigned_to":"55e425cb-5041-4ea4-92c3-ce2f1dbce6a0","assigned_name":"Pauline BECQUERELLE"}'::jsonb, '2026-04-11T08:29:53.354Z', '2026-04-11T08:29:53.354Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('384c08ad-6ec4-4ddb-b447-0afd71e4bc37', 'a8596f8c-f3c2-41c0-85eb-d4db27b74051', 'create-meeting', 'Creer meeting R0', 'Type R0, 30min, mode visio/phone', 'data', 3, TRUE, '{"meeting_type":"R0","duration_minutes":30}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('3ead0e1f-d012-4076-8fd7-17faedb05b22', '66100f22-b7ad-4564-9d7e-5fe17292cd9b', 'create-update-company', 'Creer/MAJ entreprise', 'Recherche par nom, cree si inexistante', 'data', 1, TRUE, '{}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('43e857d4-8978-4ba0-ab41-632aee55e9ac', 'd4af754a-942d-481d-91e7-bffaef55b0ca', 'slack-dm', 'Notification Slack', 'Envoie un DM Slack au membre assigne avec les details du RDV', 'notification', 2, TRUE, '{}'::jsonb, '2026-04-11T08:29:53.354Z', '2026-04-11T08:29:53.354Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('4943e7bb-b9ba-4e66-8ecc-cd7ba370d7b6', '66100f22-b7ad-4564-9d7e-5fe17292cd9b', 'create-update-contact', 'Creer/MAJ contact', 'Statut: booked, assigne a Pauline', 'data', 2, TRUE, '{"assigned_to":"55e425cb-5041-4ea4-92c3-ce2f1dbce6a0","assigned_name":"Pauline BECQUERELLE"}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('5359e2b5-f00c-44e1-969e-0d697a2890c8', 'ef6c63a7-7b3d-43db-9b44-11fe2b0c5030', 'create-update-contact', 'Creer/MAJ contact', 'Statut: booked, assigne a Pauline (source: landing page)', 'data', 2, TRUE, '{"assigned_to":"55e425cb-5041-4ea4-92c3-ce2f1dbce6a0","assigned_name":"Pauline BECQUERELLE"}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('57b11154-4299-49bf-a673-fd95b8c771dc', '6967706b-561f-4740-889d-6e98daaa5d07', 'google-calendar-trainers', 'Google Calendar formateurs', 'Ajoute l''evenement au calendrier de chaque formateur', 'calendar', 1, TRUE, '{}'::jsonb, '2026-04-11T08:56:19.663Z', '2026-04-11T08:56:19.663Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('58dfe7aa-94a3-4e54-aae4-d007b5a615b0', '9febacfe-ceb7-4861-b6c2-8b55a13f93fe', 'slack-reminder', 'Rappel Slack', 'Envoie un DM Slack a chaque membre avec ses taches en retard', 'notification', 2, TRUE, '{}'::jsonb, '2026-04-11T08:30:09.199Z', '2026-04-11T08:30:09.199Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('5ad0db04-2a96-4be8-ba08-97820bc989d5', 'c7da1286-3180-4407-8055-63e3ec0e6f33', 'slack-notify-iman', 'Notification Slack Iman', 'Envoie un DM Slack a Iman pour signaler l''annulation', 'notification', 1, TRUE, '{}'::jsonb, '2026-04-11T08:56:19.663Z', '2026-04-11T08:56:19.663Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('62e14b63-9633-4356-987d-508038857d1b', '800f7270-d470-450e-a13e-2d4f4bf1552f', 'sync-google-calendar', 'Sync Google Calendar formateurs', 'Ajoute l''evenement au calendrier de chaque formateur', 'calendar', 1, TRUE, '{}'::jsonb, '2026-04-11T08:29:53.354Z', '2026-04-11T08:29:53.354Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('74039b8a-9b56-4cb2-8ffc-115498400f1b', '800f7270-d470-450e-a13e-2d4f4bf1552f', 'email-learners-ics', 'Email .ics apprenants', 'Envoie un email avec fichier .ics a chaque apprenant ayant un email', 'email', 4, TRUE, '{}'::jsonb, '2026-04-11T08:56:19.663Z', '2026-04-11T08:56:19.663Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('76a4edba-2660-4a48-8957-497c18660b2b', '6967706b-561f-4740-889d-6e98daaa5d07', 'email-learners-ics', 'Email .ics apprenants', 'Envoie un email avec invitation .ics a chaque apprenant', 'email', 4, TRUE, '{}'::jsonb, '2026-04-11T08:56:19.663Z', '2026-04-11T08:56:19.663Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('81e1d39e-1d1e-436c-bc1a-ccc344688cce', '9febacfe-ceb7-4861-b6c2-8b55a13f93fe', 'check-overdue', 'Verifier taches en retard', 'Identifie les taches dont la date est depassee et non completees', 'data', 1, TRUE, '{}'::jsonb, '2026-04-11T08:30:09.199Z', '2026-04-11T08:30:09.199Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('81fbdb0d-fa61-4610-822f-b70dcb5f7825', '91730700-24f1-42e5-a574-7083b6946c0d', 'trigger-notifications', 'Déclencher notifications', NULL, 'notification', 4, TRUE, '{}'::jsonb, '2026-04-14T08:52:34.158Z', '2026-04-14T08:52:34.158Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('8478fbf8-dcfd-4dae-b0e6-9c4fc48c6c51', 'dd3e8cbf-c5ef-445e-9647-929a9195fdd3', 'send-book-pdf', 'Envoi Book PDF au prospect', 'Envoie le Book Financements 2026 en PDF si la source est un tunnel book', 'email', 5, TRUE, '{"condition":"source is landing-book-financement or embed-form-book"}'::jsonb, '2026-04-11T08:30:09.199Z', '2026-04-11T08:30:09.199Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('893645f2-4b79-44eb-ac96-f6fe16cb80d4', '800f7270-d470-450e-a13e-2d4f4bf1552f', 'email-trainers-no-gcal', 'Email formateurs sans GCal', 'Envoie un email aux formateurs qui n''ont pas de Google Calendar (ex: Guillaume)', 'email', 2, TRUE, '{}'::jsonb, '2026-04-11T08:29:53.354Z', '2026-04-11T08:29:53.354Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('8fb9e999-d572-42a7-84e1-83b45f877d4a', 'ef6c63a7-7b3d-43db-9b44-11fe2b0c5030', 'trigger-notifications', 'Declencher notifications', 'Appel au pipeline /api/meetings/notify', 'notification', 4, TRUE, '{}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('904131df-5283-450e-ad7c-5fdc89e51136', 'd4af754a-942d-481d-91e7-bffaef55b0ca', 'email-prospect-ics', 'Email confirmation prospect', 'Envoie un email de confirmation avec .ics au prospect', 'email', 4, TRUE, '{}'::jsonb, '2026-04-11T08:29:53.354Z', '2026-04-11T08:29:53.354Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('9410db3b-39db-438b-8d35-0100be31b93f', '89dbb3a3-74ea-427f-95d1-64ee7f3fc7b6', 'create-meeting', 'Creer meeting R0', 'Type R0, 15min, visio/phone (appel decouverte)', 'data', 3, TRUE, '{"meeting_type":"R0","duration_minutes":15}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('9e9d3f49-533d-460f-8c73-a2da6edb9a68', 'a8596f8c-f3c2-41c0-85eb-d4db27b74051', 'create-update-contact', 'Creer/MAJ contact', 'Statut: booked, assigne au membre choisi', 'data', 2, TRUE, '{}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('9ed6c54d-acd2-4a76-8305-b3a2576b8463', 'dd3e8cbf-c5ef-445e-9647-929a9195fdd3', 'notify-pauline', 'Email notification Pauline', 'Envoie un email a Pauline pour signaler le nouveau lead', 'email', 3, TRUE, '{"recipient":"pauline-ext@closing-academie.com","recipient_name":"Pauline"}'::jsonb, '2026-04-11T08:30:09.199Z', '2026-04-11T08:30:09.199Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('b17efe46-0ed8-4e36-bf02-f14913816285', 'd4af754a-942d-481d-91e7-bffaef55b0ca', 'email-externe-ics', 'Email .ics membre externe', 'Envoie un email avec fichier .ics aux membres Externe', 'email', 3, TRUE, '{}'::jsonb, '2026-04-11T08:29:53.354Z', '2026-04-11T08:29:53.354Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('b2758c59-ba70-40aa-bcdc-0e5ee4edfd53', 'ef6c63a7-7b3d-43db-9b44-11fe2b0c5030', 'create-meeting', 'Creer meeting R0', 'Type R0, 15min, telephone', 'data', 3, TRUE, '{"mode":"phone","meeting_type":"R0","duration_minutes":15}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('b372b5e6-5613-4572-9aac-fcb1e7b7be64', '6967706b-561f-4740-889d-6e98daaa5d07', 'email-externe-ics', 'Email .ics formateurs externes', 'Envoie un email avec .ics aux formateurs Externe', 'email', 3, TRUE, '{}'::jsonb, '2026-04-11T08:56:19.663Z', '2026-04-11T08:56:19.663Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('c2a9baab-621b-427f-9537-8b3d9e03c3ea', '91730700-24f1-42e5-a574-7083b6946c0d', 'create-meeting', 'Créer meeting R0', NULL, 'data', 3, TRUE, '{}'::jsonb, '2026-04-14T08:52:34.158Z', '2026-04-14T08:52:34.158Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('c7ea20f5-3a44-400b-997c-6c6cfb967d0f', '800f7270-d470-450e-a13e-2d4f4bf1552f', 'slack-trainers', 'Notification Slack formateurs', 'Envoie un message Slack aux formateurs avec les details de la session', 'notification', 3, TRUE, '{}'::jsonb, '2026-04-11T08:29:53.354Z', '2026-04-11T08:29:53.354Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('d165bda2-983c-4f13-ac5a-a3d3078bd663', '89dbb3a3-74ea-427f-95d1-64ee7f3fc7b6', 'trigger-notifications', 'Declencher notifications', 'Appel au pipeline /api/meetings/notify', 'notification', 4, TRUE, '{}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('d19cf6a7-6bf7-4862-9057-db3f844fe5a0', 'dd3e8cbf-c5ef-445e-9647-929a9195fdd3', 'create-update-company', 'Creer/MAJ entreprise', 'Recherche par URL du site web, cree si inexistante', 'data', 1, TRUE, '{}'::jsonb, '2026-04-11T08:30:09.199Z', '2026-04-11T08:30:09.199Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('d8bf3c31-4edd-461e-a116-dec85586c929', '89dbb3a3-74ea-427f-95d1-64ee7f3fc7b6', 'create-update-company', 'Creer/MAJ entreprise', 'Recherche par nom, cree si inexistante', 'data', 1, TRUE, '{}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('d8e12d09-6e32-4803-ae67-515202d7c954', '89dbb3a3-74ea-427f-95d1-64ee7f3fc7b6', 'create-update-contact', 'Creer/MAJ contact', 'Statut: booked, assigne a Naznine (decouverte)', 'data', 2, TRUE, '{"assigned_to":"9bcd91e5-0c11-44ba-9bc8-1de4bad9c040","assigned_name":"Naznine MOUHAMAD"}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('d9f51b9e-c767-4b37-8755-99ee2d6fa959', '43cde2d4-5afb-4555-b8d6-9c692129e54e', 'create-update-contact', 'Creer/MAJ contact', 'Lifecycle: lead_marketing, assigne a Pauline', 'data', 1, TRUE, '{"assigned_to":"55e425cb-5041-4ea4-92c3-ce2f1dbce6a0","assigned_name":"Pauline BECQUERELLE"}'::jsonb, '2026-04-11T08:30:09.199Z', '2026-04-11T08:30:09.199Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('dc7ae814-364e-4a00-b337-1a1b96450554', 'ef6c63a7-7b3d-43db-9b44-11fe2b0c5030', 'create-update-company', 'Creer/MAJ entreprise', 'Recherche par nom, cree si inexistante', 'data', 1, TRUE, '{}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('ea23972b-c6ec-4023-b84a-fd63773e23a1', '829323a8-8c88-4593-9d9d-09a55e1eb850', 'create-meeting', 'Creer meeting R0', 'Type R0, 15min, visio/phone', 'data', 3, TRUE, '{"meeting_type":"R0","duration_minutes":15}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('ea3b27d3-be52-44f4-9951-198e73007caa', 'd6437b2b-1b05-457f-921d-861110938566', 'upsert-delivery', 'Enregistrement delivery', 'Cree ou met a jour l''enregistrement dans la table sessions (delivery)', 'data', 1, TRUE, '{}'::jsonb, '2026-04-11T08:29:53.354Z', '2026-04-11T08:29:53.354Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('ede1b254-cddb-4941-82fa-2568fd4c1f1c', '829323a8-8c88-4593-9d9d-09a55e1eb850', 'create-update-contact', 'Creer/MAJ contact', 'Statut: booked, assigne a Naznine', 'data', 2, TRUE, '{"assigned_to":"9bcd91e5-0c11-44ba-9bc8-1de4bad9c040","assigned_name":"Naznine MOUHAMAD"}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('f2ffe27a-135d-492d-8739-b58ff4e3f0de', '43cde2d4-5afb-4555-b8d6-9c692129e54e', 'match-company', 'Associer entreprise', 'Recherche une entreprise par URL du site web et lie au contact', 'data', 2, TRUE, '{}'::jsonb, '2026-04-11T08:30:09.199Z', '2026-04-11T08:30:09.199Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('f72e20d9-1d58-4a79-8f25-53d1be0e04a9', '829323a8-8c88-4593-9d9d-09a55e1eb850', 'trigger-notifications', 'Declencher notifications', 'Appel au pipeline /api/meetings/notify', 'notification', 4, TRUE, '{}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('f9810fac-11ae-4958-8a97-d5578fde429c', 'dd3e8cbf-c5ef-445e-9647-929a9195fdd3', 'create-update-contact', 'Creer contact lead marketing', 'Lifecycle: lead_marketing, lead_status: lead', 'data', 2, TRUE, '{}'::jsonb, '2026-04-11T08:30:09.199Z', '2026-04-11T08:30:09.199Z') ON CONFLICT DO NOTHING;
INSERT INTO public."automation_steps" ("id", "workflow_id", "slug", "name", "description", "step_type", "step_order", "is_active", "config", "created_at", "updated_at") VALUES ('fa1e4d5a-e144-4b50-8744-0f8681911012', '66100f22-b7ad-4564-9d7e-5fe17292cd9b', 'trigger-notifications', 'Declencher notifications', 'Appel au pipeline /api/meetings/notify', 'notification', 4, TRUE, '{}'::jsonb, '2026-04-11T08:29:41.551Z', '2026-04-11T08:29:41.551Z') ON CONFLICT DO NOTHING;

-- Nurture email sequences
INSERT INTO public."nurture_sequences" ("id", "slug", "name", "trigger", "anchor", "is_active", "from_account_id", "created_at") VALUES ('0d3bafa2-9f0d-4beb-83d4-b34b487e3f00', 'noshow-r1', 'Relance no-show R1 (lead chaud, 2e RDV manqué)', 'no_show_r1', 'enrollment', TRUE, NULL, '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_sequences" ("id", "slug", "name", "trigger", "anchor", "is_active", "from_account_id", "created_at") VALUES ('2cb38270-7153-412a-9663-97d188949c35', 'pre-rdv', 'Pré-RDV (garder le lead chaud avant le bilan)', 'booked', 'meeting', TRUE, NULL, '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_sequences" ("id", "slug", "name", "trigger", "anchor", "is_active", "from_account_id", "created_at") VALUES ('7e18eb40-23ad-4c32-9032-cdbedf8a3409', 'noshow-r0', 'Relance no-show R0 (lead froid Meta)', 'no_show_r0', 'enrollment', TRUE, NULL, '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_sequences" ("id", "slug", "name", "trigger", "anchor", "is_active", "from_account_id", "created_at") VALUES ('d610aaea-4305-4826-b930-078ab92166e5', 'vsl-nurturing', 'Nurturing VSL (leads opt-in non bookés)', 'optin_vsl', 'enrollment', TRUE, NULL, '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;

-- Nurture email sequence steps
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('0921d8f0-3aca-44ce-b0ce-c0d895ffef10', 'd610aaea-4305-4826-b930-078ab92166e5', 5, 168, 'email', 'Soyons transparents', 'Bonjour,

Je préfère être transparent avec vous.
Nous ne pouvons pas accompagner tout le monde.
Nous travaillons uniquement avec des dirigeants prêts à structurer réellement leur organisation commerciale et à passer un cap.

Le bilan stratégique permet justement de vérifier si :
- Votre situation est adaptée à notre accompagnement
- Nous pouvons réellement vous aider
- Une collaboration serait pertinente

Si vous êtes dans cette démarche, vous pouvez réserver votre session ici : {{bookingLink}}

Et si vous avez encore des doutes sur les résultats que nos clients obtiennent en suivant notre méthode, prenez 2 minutes pour regarder cette interview : {{interviewLink}}

À très vite,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('14dbb3ed-16f5-45f6-8a85-319d3d0bde26', '2cb38270-7153-412a-9663-97d188949c35', 1, 48, 'email', 'Votre bilan commercial approche — ce qu''on va regarder ensemble', 'Bonjour {{firstName}},

Votre bilan commercial avec La Closing Académie approche, et je voulais vous donner le cadre pour qu''on en tire le maximum.

En 30 minutes, on va poser un diagnostic clair sur votre organisation commerciale : où fuient les leads, ce qui plafonne réellement la performance, et 2 ou 3 leviers activables rapidement chez vous.

Pour que ce soit le plus utile possible, venez avec une idée de vos chiffres clés — volume de leads, taux de closing, cycle de vente — même approximatifs.

À très vite,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('35cf5d56-26f7-4d1b-a89f-83bac92b468e', '2cb38270-7153-412a-9663-97d188949c35', 2, 24, 'email', 'Rappel : votre bilan commercial, c''est demain', 'Bonjour {{firstName}},

Petit rappel : on se voit demain pour votre bilan commercial.

Un chiffre pour vous mettre en appétit : un dirigeant que nous avons accompagné est passé de 1,5 à 2,7 M€ en 12 mois — pas en achetant plus de leads, mais en structurant son organisation commerciale. C''est exactement le type de leviers qu''on va chercher chez vous.

Le lien de connexion se trouve dans votre invitation d''agenda. Si un imprévu survient, répondez simplement à ce mail : on retrouvera un créneau.

À demain,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('3d8fa981-f54b-478b-89e1-0928e06c8bca', '0d3bafa2-9f0d-4beb-83d4-b34b487e3f00', 1, 0, 'email', 'On reprogramme quand ?', 'Bonjour {{firstName}},

Notre RDV était prévu aujourd''hui mais on s''est manqués. Aucun souci — je sais à quel point un agenda de dirigeant peut sauter.

Je vous propose de reprogrammer rapidement, tant que le sujet est frais : {{bookingLink}}

À très vite,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('3f236fb6-c567-442a-a34e-0c4931729315', '7e18eb40-23ad-4c32-9032-cdbedf8a3409', 1, 0, 'email', 'On s''est manqués', 'Bonjour {{firstName}},

Notre échange était prévu aujourd''hui mais on s''est manqués — pas de souci, ça arrive.

Si le sujet est toujours d''actualité de votre côté, voici le lien pour reprendre un créneau qui vous arrange : {{bookingLink}}

Le bilan dure 30 minutes et reste sans engagement. L''idée : faire un point clair sur votre organisation commerciale et identifier 2 ou 3 leviers activables rapidement.

À très vite,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('40266641-d0cc-413b-8586-e2ae58bc7c35', 'd610aaea-4305-4826-b930-078ab92166e5', 2, 24, 'email', 'Pourquoi la plupart des OF stagnent', 'Bonjour,

La majorité des dirigeants d''organismes de formation pensent que leur problème vient du marketing.
Pas assez de leads.
Des leads pas assez qualifiés.
Un coût d''acquisition trop élevé.

Mais dans 80 % des cas, le véritable blocage est ailleurs.

Il se situe dans :
- L''organisation commerciale
- Les process de vente
- La posture des équipes
- Le pilotage de la performance

On peut générer des leads en continu…
Si la structure commerciale ne suit pas, la croissance plafonne.

C''est précisément ce que nous analysons lors du bilan stratégique que l''on vous offre.

Si vous souhaitez faire un point clair et structuré, en parlant chiffres et performance commerciale, vous pouvez réserver votre session ici : {{bookingLink}}

À bientôt,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('40accd21-b7f5-4fc7-9333-2d8b41260f20', '2cb38270-7153-412a-9663-97d188949c35', 3, 3, 'email', 'On se voit dans quelques heures', 'Bonjour {{firstName}},

On se retrouve dans quelques heures pour votre bilan commercial.

Prévoyez un endroit au calme et vos quelques chiffres clés sous la main — on ira droit au but.

Le lien de connexion est dans votre invitation d''agenda. À tout à l''heure !

Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('75e0bfe0-c383-45eb-9137-da0d5ea52808', 'd610aaea-4305-4826-b930-078ab92166e5', 4, 120, 'email', 'La vraie question à vous poser', 'Bonjour,

Voici une question simple.
Si votre organisation commerciale reste identique pendant les 12 prochains mois…
où en serez-vous ?

Même volume de leads.
Même organisation.
Mêmes résultats.

Le coût de l''inaction est souvent invisible… jusqu''au moment où il devient critique.

Le bilan stratégique n''est pas un engagement.
C''est un moment de clarté.
Un diagnostic précis pour comprendre ce qui freine réellement votre croissance.

Si vous souhaitez faire ce point ensemble : {{bookingLink}}

À très vite,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('9623caae-5b90-47d3-ad00-e7323a004b2e', 'd610aaea-4305-4826-b930-078ab92166e5', 1, 0, 'email', 'Pourquoi investir dans le marketing ne suffit plus', 'Bonjour,

Je voulais m''assurer que vous avez bien reçu l''accès à la vidéo de présentation.

Dans cette vidéo, je vous explique pourquoi beaucoup d''organismes de formation stagnent aujourd''hui, même avec un volume de leads correct, et surtout ce qui bloque réellement la performance commerciale.

Je vous recommande de la regarder jusqu''au bout !

Vous y découvrirez :
- Comment nos clients tels que Wall Street English, ABC Formation Continue, et bien d''autres ont doublé leur gain par lead en un trimestre
- Les erreurs structurelles les plus fréquentes qui vous coûtent très cher
- Pourquoi ajouter du marketing ne suffit plus
- Comment structurer une organisation commerciale réellement performante

À la fin, je vous propose également de bénéficier d''un bilan stratégique offert pour analyser votre situation actuelle.

Accéder à la vidéo : {{vslLink}}

À très vite,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('96536d65-e363-4c46-b42f-810ef814d671', 'd610aaea-4305-4826-b930-078ab92166e5', 3, 72, 'email', 'Cas concret : +1,2M€ en 12 mois', 'Bonjour,

Un dirigeant que nous avons accompagné réalisait 1,5 M€ de chiffre d''affaires.
Ses équipes travaillaient beaucoup.
Les leads entraient.
Mais la performance commerciale stagnait.

Nous avons travaillé sur :
- La structuration de l''organisation commerciale
- La clarification des rôles
- L''optimisation des process de vente
- La montée en compétence des équipes

Résultat : 2,7 M€ de chiffre d''affaires en 12 mois.

Ce n''est pas une question de chance.
C''est une question de structure et de méthode.

C''est exactement ce que nous évaluons lors du bilan commercial offert !

Si vous souhaitez voir ce qui est activable dans votre organisation : {{bookingLink}}

À très vite,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('bf02b5cd-105d-4568-9874-04b453a25a74', 'd610aaea-4305-4826-b930-078ab92166e5', 6, 216, 'email', 'Il voulait le licencier 6 mois plus tôt, il finit top sales', 'Bonjour,

Le directeur franchisé de Wall Street English Grenoble, Tayeb Yadel, était à deux doigts de se séparer d''un de ses commerciaux.
Résultats jugés insuffisants.
Manque d''impact en rendez-vous.
Doutes sur sa capacité à performer.

La décision semblait presque prise… et La Closing Académie est arrivée !

Nous avons alors travaillé avec l''équipe sur :
- La structuration du process de vente
- La posture commerciale
- Le pilotage de la performance
- L''accompagnement managérial
- Et surtout… un changement radical d''état d''esprit qui a fait la différence

Quelques mois plus tard, ce même commercial terminait 2ème meilleur vendeur sur plus de 200 commerciaux, avec en prime les félicitations du PDG !

Le problème n''était pas la personne.
Le problème était la structure et le cadre dans lequel elle évoluait.

C''est exactement ce que nous travaillons avec les dirigeants que nous accompagnons.

Si vous souhaitez découvrir l''interview complète de Tayeb : {{interviewLink}}

Et si vous souhaitez analyser votre propre organisation commerciale : {{bookingLink}}

À bientôt,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('c3f3eb3d-3522-4d2d-8f81-cbc299939a05', 'd610aaea-4305-4826-b930-078ab92166e5', 7, 312, 'email', 'Dois-je clôturer votre dossier ?', 'Bonjour,

Je n''ai pas eu de retour suite à votre inscription à la présentation.

Peut-être que ce n''est pas le bon moment.
Peut-être que votre organisation commerciale fonctionne déjà parfaitement.
Ou peut-être que vous hésitez encore.

Si vous souhaitez faire un point stratégique pour clarifier votre situation et identifier vos leviers de croissance, voici le lien pour réserver : {{bookingLink}}

Sans réponse de votre part, je considérerai simplement que le timing n''est pas prioritaire pour vous.

Quoi qu''il en soit, je vous souhaite une excellente continuation.
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('c8c66cd0-e07e-4c50-a791-196be3827537', '0d3bafa2-9f0d-4beb-83d4-b34b487e3f00', 2, 48, 'email', 'Quand seriez-vous disponible cette semaine ?', 'Bonjour {{firstName}},

Je relance simplement pour reprogrammer notre point. On avait commencé à parler de votre organisation commerciale lors de notre 1er échange — j''aimerais qu''on aille au bout du diagnostic.

Voici 2 options :
1. Reprogrammer un créneau ici : {{bookingLink}}
2. Me dire en deux lignes ce qui bloque, je m''adapte

À très vite,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('d502eab5-3480-45d5-8590-81e57bd35dcf', '7e18eb40-23ad-4c32-9032-cdbedf8a3409', 3, 120, 'email', 'Je clôture votre dossier ?', 'Bonjour {{firstName}},

Sans nouvelle de votre part, je préfère vous le demander directement : souhaitez-vous toujours faire ce point ensemble ?

Si oui, le lien reste actif : {{bookingLink}}

Si le timing n''est pas le bon, aucun problème — je clôture votre dossier de mon côté et vous souhaite une excellente continuation.

Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;
INSERT INTO public."nurture_steps" ("id", "sequence_id", "step_order", "delay_hours", "channel", "subject", "body", "created_at") VALUES ('f3ead300-9628-4295-bdd5-a6f9494a16f4', '7e18eb40-23ad-4c32-9032-cdbedf8a3409', 2, 48, 'email', 'Quand seriez-vous disponible cette semaine ?', 'Bonjour {{firstName}},

Je relance simplement au cas où mon précédent message vous aurait échappé.

Beaucoup de dirigeants d''OF que nous accompagnons partent du même constat : le volume de leads est correct, mais la performance commerciale stagne. Le bilan stratégique sert justement à poser un diagnostic chiffré sur ce point — taux de closing, cycles de vente, gain par lead.

Si c''est un sujet pour vous, voici le lien pour réserver un créneau : {{bookingLink}}

À très vite,
Rafi', '2026-07-07T16:21:11.346Z') ON CONFLICT DO NOTHING;

-- Quote number sequence (reset for new client)
INSERT INTO public."quote_sequences" (year, last_number) VALUES (2026, 0) ON CONFLICT DO NOTHING;

