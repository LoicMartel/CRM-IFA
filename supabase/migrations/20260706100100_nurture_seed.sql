-- Seed des séquences de nurturing + relances no-show (contenu WF-004, brouillon validé équipe).
-- Merge tags résolus par l'endpoint /api/cron/nurture : {{firstName}}, {{bookingLink}},
-- {{vslLink}}, {{interviewLink}}. Les liens vidéo (VSL, interviews) = contenu client à poser en
-- env (NURTURE_VSL_URL / NURTURE_INTERVIEW_URL) ; à défaut ils retombent sur le lien de booking.
-- from_account_id = NULL -> l'endpoint utilise UNIPILE_NURTURE_ACCOUNT_ID (compte de Rafi) sinon
-- UNIPILE_DEFAULT_EMAIL_ACCOUNT_ID. Idempotent (on conflict do nothing).
-- NOTE contenu : l'email VSL "J+11 / use case 2 avatar" reste un template à trous côté doc -> non
-- seedé (à insérer plus tard en step_order intercalé, delay 264h). Les touchpoints SMS/WhatsApp de
-- R1 ne sont pas seedés (canal non câblé ; multicanal-ready via nurture_steps.channel).

insert into nurture_sequences (slug, name, trigger, anchor, is_active, from_account_id) values
  ('vsl-nurturing', 'Nurturing VSL (leads opt-in non bookés)',        'optin_vsl',  'enrollment', true, null),
  ('pre-rdv',       'Pré-RDV (garder le lead chaud avant le bilan)',  'booked',     'meeting',    true, null),
  ('noshow-r0',     'Relance no-show R0 (lead froid Meta)',           'no_show_r0', 'enrollment', true, null),
  ('noshow-r1',     'Relance no-show R1 (lead chaud, 2e RDV manqué)', 'no_show_r1', 'enrollment', true, null)
on conflict (slug) do nothing;

-- ── Séquence pré-RDV : compte à rebours depuis le RDV (anchor='meeting') ─────
-- delay_hours = heures AVANT le RDV. J-2 (48h) / J-1 (24h) / Jour J (~3h avant).
insert into nurture_steps (sequence_id, step_order, delay_hours, channel, subject, body) values
((select id from nurture_sequences where slug='pre-rdv'), 1, 48, 'email',
 $s$Votre bilan commercial approche — ce qu'on va regarder ensemble$s$,
 $b$Bonjour {{firstName}},

Votre bilan commercial avec La Closing Académie approche, et je voulais vous donner le cadre pour qu'on en tire le maximum.

En 30 minutes, on va poser un diagnostic clair sur votre organisation commerciale : où fuient les leads, ce qui plafonne réellement la performance, et 2 ou 3 leviers activables rapidement chez vous.

Pour que ce soit le plus utile possible, venez avec une idée de vos chiffres clés — volume de leads, taux de closing, cycle de vente — même approximatifs.

À très vite,
Rafi$b$),

((select id from nurture_sequences where slug='pre-rdv'), 2, 24, 'email',
 $s$Rappel : votre bilan commercial, c'est demain$s$,
 $b$Bonjour {{firstName}},

Petit rappel : on se voit demain pour votre bilan commercial.

Un chiffre pour vous mettre en appétit : un dirigeant que nous avons accompagné est passé de 1,5 à 2,7 M€ en 12 mois — pas en achetant plus de leads, mais en structurant son organisation commerciale. C'est exactement le type de leviers qu'on va chercher chez vous.

Le lien de connexion se trouve dans votre invitation d'agenda. Si un imprévu survient, répondez simplement à ce mail : on retrouvera un créneau.

À demain,
Rafi$b$),

((select id from nurture_sequences where slug='pre-rdv'), 3, 3, 'email',
 $s$On se voit dans quelques heures$s$,
 $b$Bonjour {{firstName}},

On se retrouve dans quelques heures pour votre bilan commercial.

Prévoyez un endroit au calme et vos quelques chiffres clés sous la main — on ira droit au but.

Le lien de connexion est dans votre invitation d'agenda. À tout à l'heure !

Rafi$b$)
on conflict (sequence_id, step_order) do nothing;

-- ── Séquence VSL : 7 emails sur 13 jours ────────────────────────────────────
insert into nurture_steps (sequence_id, step_order, delay_hours, channel, subject, body) values
((select id from nurture_sequences where slug='vsl-nurturing'), 1, 0, 'email',
 $s$Pourquoi investir dans le marketing ne suffit plus$s$,
 $b$Bonjour,

Je voulais m'assurer que vous avez bien reçu l'accès à la vidéo de présentation.

Dans cette vidéo, je vous explique pourquoi beaucoup d'organismes de formation stagnent aujourd'hui, même avec un volume de leads correct, et surtout ce qui bloque réellement la performance commerciale.

Je vous recommande de la regarder jusqu'au bout !

Vous y découvrirez :
- Comment nos clients tels que Wall Street English, ABC Formation Continue, et bien d'autres ont doublé leur gain par lead en un trimestre
- Les erreurs structurelles les plus fréquentes qui vous coûtent très cher
- Pourquoi ajouter du marketing ne suffit plus
- Comment structurer une organisation commerciale réellement performante

À la fin, je vous propose également de bénéficier d'un bilan stratégique offert pour analyser votre situation actuelle.

Accéder à la vidéo : {{vslLink}}

À très vite,
Rafi$b$),

((select id from nurture_sequences where slug='vsl-nurturing'), 2, 24, 'email',
 $s$Pourquoi la plupart des OF stagnent$s$,
 $b$Bonjour,

La majorité des dirigeants d'organismes de formation pensent que leur problème vient du marketing.
Pas assez de leads.
Des leads pas assez qualifiés.
Un coût d'acquisition trop élevé.

Mais dans 80 % des cas, le véritable blocage est ailleurs.

Il se situe dans :
- L'organisation commerciale
- Les process de vente
- La posture des équipes
- Le pilotage de la performance

On peut générer des leads en continu…
Si la structure commerciale ne suit pas, la croissance plafonne.

C'est précisément ce que nous analysons lors du bilan stratégique que l'on vous offre.

Si vous souhaitez faire un point clair et structuré, en parlant chiffres et performance commerciale, vous pouvez réserver votre session ici : {{bookingLink}}

À bientôt,
Rafi$b$),

((select id from nurture_sequences where slug='vsl-nurturing'), 3, 72, 'email',
 $s$Cas concret : +1,2M€ en 12 mois$s$,
 $b$Bonjour,

Un dirigeant que nous avons accompagné réalisait 1,5 M€ de chiffre d'affaires.
Ses équipes travaillaient beaucoup.
Les leads entraient.
Mais la performance commerciale stagnait.

Nous avons travaillé sur :
- La structuration de l'organisation commerciale
- La clarification des rôles
- L'optimisation des process de vente
- La montée en compétence des équipes

Résultat : 2,7 M€ de chiffre d'affaires en 12 mois.

Ce n'est pas une question de chance.
C'est une question de structure et de méthode.

C'est exactement ce que nous évaluons lors du bilan commercial offert !

Si vous souhaitez voir ce qui est activable dans votre organisation : {{bookingLink}}

À très vite,
Rafi$b$),

((select id from nurture_sequences where slug='vsl-nurturing'), 4, 120, 'email',
 $s$La vraie question à vous poser$s$,
 $b$Bonjour,

Voici une question simple.
Si votre organisation commerciale reste identique pendant les 12 prochains mois…
où en serez-vous ?

Même volume de leads.
Même organisation.
Mêmes résultats.

Le coût de l'inaction est souvent invisible… jusqu'au moment où il devient critique.

Le bilan stratégique n'est pas un engagement.
C'est un moment de clarté.
Un diagnostic précis pour comprendre ce qui freine réellement votre croissance.

Si vous souhaitez faire ce point ensemble : {{bookingLink}}

À très vite,
Rafi$b$),

((select id from nurture_sequences where slug='vsl-nurturing'), 5, 168, 'email',
 $s$Soyons transparents$s$,
 $b$Bonjour,

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
Rafi$b$),

((select id from nurture_sequences where slug='vsl-nurturing'), 6, 216, 'email',
 $s$Il voulait le licencier 6 mois plus tôt, il finit top sales$s$,
 $b$Bonjour,

Le directeur franchisé de Wall Street English Grenoble, Tayeb Yadel, était à deux doigts de se séparer d'un de ses commerciaux.
Résultats jugés insuffisants.
Manque d'impact en rendez-vous.
Doutes sur sa capacité à performer.

La décision semblait presque prise… et La Closing Académie est arrivée !

Nous avons alors travaillé avec l'équipe sur :
- La structuration du process de vente
- La posture commerciale
- Le pilotage de la performance
- L'accompagnement managérial
- Et surtout… un changement radical d'état d'esprit qui a fait la différence

Quelques mois plus tard, ce même commercial terminait 2ème meilleur vendeur sur plus de 200 commerciaux, avec en prime les félicitations du PDG !

Le problème n'était pas la personne.
Le problème était la structure et le cadre dans lequel elle évoluait.

C'est exactement ce que nous travaillons avec les dirigeants que nous accompagnons.

Si vous souhaitez découvrir l'interview complète de Tayeb : {{interviewLink}}

Et si vous souhaitez analyser votre propre organisation commerciale : {{bookingLink}}

À bientôt,
Rafi$b$),

((select id from nurture_sequences where slug='vsl-nurturing'), 7, 312, 'email',
 $s$Dois-je clôturer votre dossier ?$s$,
 $b$Bonjour,

Je n'ai pas eu de retour suite à votre inscription à la présentation.

Peut-être que ce n'est pas le bon moment.
Peut-être que votre organisation commerciale fonctionne déjà parfaitement.
Ou peut-être que vous hésitez encore.

Si vous souhaitez faire un point stratégique pour clarifier votre situation et identifier vos leviers de croissance, voici le lien pour réserver : {{bookingLink}}

Sans réponse de votre part, je considérerai simplement que le timing n'est pas prioritaire pour vous.

Quoi qu'il en soit, je vous souhaite une excellente continuation.
Rafi$b$)
on conflict (sequence_id, step_order) do nothing;

-- ── Séquence no-show R0 (lead froid Meta) : 3 emails ────────────────────────
insert into nurture_steps (sequence_id, step_order, delay_hours, channel, subject, body) values
((select id from nurture_sequences where slug='noshow-r0'), 1, 0, 'email',
 $s$On s'est manqués$s$,
 $b$Bonjour {{firstName}},

Notre échange était prévu aujourd'hui mais on s'est manqués — pas de souci, ça arrive.

Si le sujet est toujours d'actualité de votre côté, voici le lien pour reprendre un créneau qui vous arrange : {{bookingLink}}

Le bilan dure 30 minutes et reste sans engagement. L'idée : faire un point clair sur votre organisation commerciale et identifier 2 ou 3 leviers activables rapidement.

À très vite,
Rafi$b$),

((select id from nurture_sequences where slug='noshow-r0'), 2, 48, 'email',
 $s$Quand seriez-vous disponible cette semaine ?$s$,
 $b$Bonjour {{firstName}},

Je relance simplement au cas où mon précédent message vous aurait échappé.

Beaucoup de dirigeants d'OF que nous accompagnons partent du même constat : le volume de leads est correct, mais la performance commerciale stagne. Le bilan stratégique sert justement à poser un diagnostic chiffré sur ce point — taux de closing, cycles de vente, gain par lead.

Si c'est un sujet pour vous, voici le lien pour réserver un créneau : {{bookingLink}}

À très vite,
Rafi$b$),

((select id from nurture_sequences where slug='noshow-r0'), 3, 120, 'email',
 $s$Je clôture votre dossier ?$s$,
 $b$Bonjour {{firstName}},

Sans nouvelle de votre part, je préfère vous le demander directement : souhaitez-vous toujours faire ce point ensemble ?

Si oui, le lien reste actif : {{bookingLink}}

Si le timing n'est pas le bon, aucun problème — je clôture votre dossier de mon côté et vous souhaite une excellente continuation.

Rafi$b$)
on conflict (sequence_id, step_order) do nothing;

-- ── Séquence no-show R1 (lead chaud, 2e RDV manqué) : emails J+0 / J+2 ───────
-- (SMS J+0 + WhatsApp J+2 + tâche manuelle J+5 = non seedés : canaux non câblés / I3.)
insert into nurture_steps (sequence_id, step_order, delay_hours, channel, subject, body) values
((select id from nurture_sequences where slug='noshow-r1'), 1, 0, 'email',
 $s$On reprogramme quand ?$s$,
 $b$Bonjour {{firstName}},

Notre RDV était prévu aujourd'hui mais on s'est manqués. Aucun souci — je sais à quel point un agenda de dirigeant peut sauter.

Je vous propose de reprogrammer rapidement, tant que le sujet est frais : {{bookingLink}}

À très vite,
Rafi$b$),

((select id from nurture_sequences where slug='noshow-r1'), 2, 48, 'email',
 $s$Quand seriez-vous disponible cette semaine ?$s$,
 $b$Bonjour {{firstName}},

Je relance simplement pour reprogrammer notre point. On avait commencé à parler de votre organisation commerciale lors de notre 1er échange — j'aimerais qu'on aille au bout du diagnostic.

Voici 2 options :
1. Reprogrammer un créneau ici : {{bookingLink}}
2. Me dire en deux lignes ce qui bloque, je m'adapte

À très vite,
Rafi$b$)
on conflict (sequence_id, step_order) do nothing;
