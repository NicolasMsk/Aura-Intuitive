# Rapport GEO Audit — auraintuitive.fr
**Date :** 16 mars 2026 | **Outil :** Claude Code GEO Audit

---

## Score GEO Composite : 42 / 100 — Faible

> Site techniquement solide mais invisible pour les IA. La fondation existe ; l'autorité externe est quasi absente.

### Décomposition des scores

| Catégorie | Poids | Score | Contribution |
|---|---|---|---|
| Visibilité IA & Citabilité | 25% | 54.6 | 13.7 |
| Autorité de marque (mentions externes) | 20% | 8 | 1.6 |
| Qualité contenu & E-E-A-T | 20% | 41 | 8.2 |
| Fondations techniques | 15% | 68 | 10.2 |
| Données structurées (Schema) | 10% | 42 | 4.2 |
| Optimisation plateformes IA | 10% | 41 | 4.1 |
| **TOTAL** | **100%** | **42 / 100** | |

### Scores par agent

| Agent | Score | Niveau |
|---|---|---|
| Visibilité IA (citabilité + crawlers + llms.txt + brand) | 54.6/100 | Moyen |
| Plateformes IA (Google AIO, ChatGPT, Perplexity, Gemini, Bing) | 41/100 | Faible |
| SEO Technique | 68/100 | Moyen |
| Contenu & E-E-A-T | 41/100 | Faible |
| Schema & Données structurées | 42/100 | Faible |

---

## Contexte du site

- **Type :** Service de voyance en ligne (France, français)
- **Modèle :** Consultations par email — Réponse Oui/Non (1€) + Consultation Ressenti (10€)
- **Fondatrice :** Laura, médium intuitive
- **Blog :** 15 articles publiés en 5 jours (2-7 mars 2026)
- **Pages indexées :** 17 URLs dans le sitemap
- **Technologie :** Site statique custom, SSR, Service Worker (PWA), Stripe, Google Analytics

---

## Points forts détectés

| Signal | Statut |
|---|---|
| Rendu côté serveur (SSR) — contenu lisible par les crawlers IA sans JS | ✅ Excellent |
| robots.txt — tous les bots IA autorisés | ✅ Bon |
| llms.txt présent et référencé dans robots.txt | ✅ Présent (à améliorer) |
| Sitemap XML avec 17 URLs et dates lastmod | ✅ Bon |
| HTTPS + Stripe sécurisé | ✅ Bon |
| Structure d'URL propre et descriptive | ✅ Excellent |
| Schema ProfessionalService, FAQPage, BlogPosting, BreadcrumbList | ✅ Partiels |
| Langage HTML `lang="fr"` correctement déclaré | ✅ Bon |
| Avertissement médical/légal visible avant consultation | ✅ Bon |

---

## Problèmes critiques

### 1. LÉGAL — Page Mentions Légales absente (violation de loi française)
**Impact : Légal + Confiance**

La loi LCEN (Loi pour la Confiance dans l'Économie Numérique) exige pour tout site commercial français :
- Nom complet ou dénomination sociale de l'exploitant
- Adresse physique
- Numéro SIRET
- Coordonnées email de contact
- Hébergeur du site

Cette page est absente. C'est une infraction, une barrière à la confiance Google, et un signal négatif pour les IA qui évaluent la légitimité d'un service.

**Fix :** Créer `/mentions-legales` avec toutes les informations légales. Lier depuis le footer.

---

### 2. RGPD — Google Analytics sans consentement cookies
**Impact : Légal + Confiance**

Google Analytics (tag G-JBCXB0EWH4) est actif sur toutes les pages sans bandeau de consentement ni politique de cookies visible. C'est une violation directe du RGPD pour les utilisateurs français (CNIL).

Paradoxe : la FAQ affirme que les données sont protégées — mais GA collecte sans consentement.

**Fix :** Implémenter un gestionnaire de consentement (ex. Axeptio, Cookiebot) + page `/politique-cookies`.

---

### 3. AUTORITÉ DE MARQUE — Présence externe quasi nulle (8/100)
**Impact : IA Citation + E-E-A-T**

Les IA (ChatGPT, Perplexity, Gemini, Bing Copilot) s'appuient sur des signaux tiers pour citer un site. Aura Intuitive n'existe sur aucune plateforme que les IA consultent :

| Plateforme | Statut |
|---|---|
| Wikipedia | ❌ Absent |
| Wikidata | ❌ Absent |
| Reddit | ❌ Absent |
| Trustpilot / Avis Vérifiés | ❌ Absent |
| LinkedIn (page entreprise) | ❌ Absent |
| YouTube | ❌ Non confirmé |
| Google Business Profile | ❌ Absent (service en ligne) |
| Presse / blogs tiers | ❌ Absent |

C'est **le problème racine** de la visibilité IA. Aucun des 5 moteurs IA ne peut citer auraintuitive.fr avec confiance sans validation externe.

---

### 4. llms.txt — Format non conforme au standard
**Impact : Visibilité IA**

Le fichier `llms.txt` existe (excellent !) mais est rédigé en prose libre. Il ne respecte pas la spécification llms.txt (H1, description en blockquote, sections H2, liens markdown par page).

Les crawlers IA cherchent la structure standard. Le fichier actuel perd 60% de sa valeur.

**Fix :** Voir le template complet en section "Actions prioritaires".

---

### 5. SCHEMA — Image manquante sur tous les BlogPosting
**Impact : Rich Results Google**

La propriété `image` est absente de tous les schémas `BlogPosting`. C'est une **exigence obligatoire** de Google pour les rich results d'articles. Sans elle, aucun article du blog n'est éligible à l'affichage enrichi dans les SERP, quelle que soit la qualité du contenu.

---

### 6. CONTENU — Signaux E-E-A-T insuffisants pour une niche YMYL-adjacent
**Impact : Google + IA citabilité**

| Dimension | Score | Problème |
|---|---|---|
| Expérience | 10/25 | Voix à la 1ère personne présente, mais aucun cas concret, aucun résultat documenté |
| Expertise | 8/25 | Laura nommée, mais zéro certification, zéro méthodologie vérifiable |
| Autorité | 8/25 | Aucune mention externe, aucune citation, TikTok comme seule présence externe |
| Fiabilité | 12/25 | Stripe, HTTPS, disclaimer médical — mais pas d'adresse, pas de remboursement, pas de CGV |

**Signal d'alerte :** 15 articles publiés en 5 jours avec structure identique → fort signal de contenu IA généré, sans données originales, sans cas réels, sans liens externes.

---

## Plan d'action prioritaire

### Priorité CRITIQUE (à faire maintenant)

| # | Action | Impact | Effort |
|---|---|---|---|
| 1 | Créer la page Mentions Légales (obligation légale LCEN) | Légal + Confiance | 1h |
| 2 | Ajouter le bandeau RGPD + politique cookies (CNIL) | Légal + Confiance | 2h |
| 3 | Créer un profil Trustpilot ou Avis Vérifiés et demander des avis aux clients | Brand Authority | 2h |
| 4 | Réécrire llms.txt au format standard (voir template ci-dessous) | IA Visibilité | 1h |

### Priorité HAUTE

| # | Action | Impact | Effort |
|---|---|---|---|
| 5 | Ajouter `image` (ImageObject 1200×630px) à tous les schémas BlogPosting | Rich Results | 2h |
| 6 | Ajouter `AggregateRating` au schéma ProfessionalService (6 avis 5 étoiles existent) | Schema + Confiance | 1h |
| 7 | Ajouter `sameAs` au schéma Person (Laura) avec profil TikTok + autres | Entity Graph IA | 30min |
| 8 | Ajouter les directives AI crawlers explicites dans robots.txt | IA Crawlabilité | 15min |
| 9 | Enrichir la page À propos : méthodologie détaillée, cas concrets (anonymisés), politique de satisfaction | E-E-A-T | 3h |
| 10 | Ajouter width/height sur toutes les images (CLS / Core Web Vitals) | Performance | 2h |
| 11 | Vérifier et implémenter les security headers (HSTS, CSP, X-Frame-Options) | Sécurité | 2h |

### Priorité MOYENNE

| # | Action | Impact | Effort |
|---|---|---|---|
| 12 | Créer une page LinkedIn entreprise "Aura Intuitive" | Brand + Bing | 1h |
| 13 | Réécrire les introductions d'articles en "blocs réponse" de 40-60 mots | IA Citabilité | 4h |
| 14 | Ajouter le schéma `speakable` sur homepage et articles | Assistants vocaux IA | 2h |
| 15 | Ajouter `WebSite` schema avec SearchAction | Entity Graph | 30min |
| 16 | Améliorer la meta description de `/a-propos` (60 chars → 155 chars) | SEO | 10min |
| 17 | Ajouter une page FAQ autonome `/faq` (actuellement ancre sur homepage) | SEO + IA | 1h |
| 18 | Créer une page CGV/politique de remboursement | Confiance | 1h |
| 19 | Implémenter IndexNow + Bing Webmaster Tools | Bing Copilot | 1h |
| 20 | Ajouter les balises Open Graph sur toutes les pages | Social + IA Preview | 2h |

### Priorité BASSE (stratégique long terme)

| # | Action | Impact | Effort |
|---|---|---|---|
| 21 | Créer une entrée Wikidata pour Aura Intuitive | Entity Recognition | 2h |
| 22 | Obtenir 2 mentions dans la presse française (blogs lifestyle, spiritualité) comme prérequis Wikipedia | ChatGPT + Perplexity | Élevé |
| 23 | Lancer une chaîne YouTube avec les formats TikTok live | Gemini + Google AIO | Élevé |
| 24 | Publier un article avec données originales ("100 consultations : ce que j'ai appris") | Perplexity Citation | Moyen |
| 25 | Amorcer une présence Reddit sur r/voyance, r/spiritualite | Perplexity Community | Moyen |

---

## Templates prêts à déployer

### llms.txt — Format standard conforme

```markdown
# Aura Intuitive

> Service de voyance en ligne par email. Consultations intuitives personnalisées dès 1€, livrées sous 24h par Laura, médium intuitive. Deux formules : Réponse Oui/Non (1€) et Consultation Ressenti (10€). Paiement unique via Stripe, sans abonnement.

## Services

- [Réponse Oui/Non](https://www.auraintuitive.fr/#services): Réponse intuitive à une question fermée — 1€, livraison par email sous 24h.
- [Consultation Ressenti](https://www.auraintuitive.fr/#services): Guidance complète et personnalisée — 10€, livraison par email sous 24h.

## À propos

- [À propos de Laura](https://www.auraintuitive.fr/a-propos): Présentation de la fondatrice, médium intuitive, et de sa philosophie de guidance honnête et accessible.

## Blog

- [Voyance à 1€ : sérieuse ou arnaque ?](https://www.auraintuitive.fr/blog/voyance-1-euro-serieuse): Indicateurs de sérieux vs escroquerie dans la voyance abordable.
- [Voyance gratuite vs payante](https://www.auraintuitive.fr/blog/voyance-gratuite-vs-payante-difference): Comparaison des deux modèles, critères de reconnaissance d'un service sérieux.
- [Comment formuler sa question à une voyante](https://www.auraintuitive.fr/blog/comment-formuler-question-voyante): Guide pratique pour des questions précises et des réponses claires.
- [Mon ex va-t-il revenir ?](https://www.auraintuitive.fr/blog/mon-ex-va-t-il-revenir-voyance): Ce que la voyance peut et ne peut pas dire sur les retours d'ex.
- [Flamme jumelle ou âme sœur](https://www.auraintuitive.fr/blog/flamme-jumelle-ame-soeur-difference): Différences clés entre les deux types de connexions spirituelles.
- [Voyance amoureuse](https://www.auraintuitive.fr/blog/voyance-amoureuse-comprendre-sentiments): Comprendre les sentiments de l'autre à travers la guidance intuitive.
- [Réponse Oui ou Non en voyance](https://www.auraintuitive.fr/blog/reponse-oui-non-voyance-fonctionnement): Fonctionnement et cas d'usage du format de consultation oui/non.
- [Signes qu'il pense à vous](https://www.auraintuitive.fr/blog/signes-il-pense-a-vous): Signaux énergétiques et intuitifs d'une présence mentale de l'autre.
- [Voyance travail et carrière](https://www.auraintuitive.fr/blog/voyance-travail-carriere-reconversion): Guidance intuitive pour les décisions professionnelles et reconversions.
- [Consultation voyance pas chère](https://www.auraintuitive.fr/blog/consultation-voyance-pas-chere): Comment trouver une voyance accessible sans sacrifier la qualité.
- [Mon ex a refait sa vie](https://www.auraintuitive.fr/blog/mon-ex-a-refait-sa-vie-voyance): Guidance pour traverser cette situation et avancer.
- [Voyance sans CB ni abonnement](https://www.auraintuitive.fr/blog/voyance-sans-cb-sans-abonnement): Modèles de voyance accessibles sans engagement financier.
- [Première consultation voyance en ligne](https://www.auraintuitive.fr/blog/premiere-consultation-voyance-en-ligne): Guide pas à pas pour une première consultation réussie.
- [Voyance gratuite en ligne : ce qu'il faut savoir](https://www.auraintuitive.fr/blog/voyance-gratuite-en-ligne-ce-quil-faut-savoir): Réalités et limites de la voyance gratuite.

## Optional

- [Sitemap](https://www.auraintuitive.fr/sitemap.xml): Plan complet du site.
```

---

### robots.txt — Directives IA explicites à ajouter

Ajouter sous les règles existantes :

```
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /
```

---

### Schema — AggregateRating à ajouter sur la homepage

Intégrer dans le bloc JSON-LD `ProfessionalService` existant :

```json
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "5",
  "reviewCount": "6",
  "bestRating": "5",
  "worstRating": "1"
},
"review": [
  {
    "@type": "Review",
    "author": {"@type": "Person", "name": "Camille"},
    "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
    "reviewBody": "Réponse reçue le jour même, personnalisée et douce."
  },
  {
    "@type": "Review",
    "author": {"@type": "Person", "name": "Inès"},
    "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
    "reviewBody": "Premier oui/non puis un ressenti dans la foulée."
  },
  {
    "@type": "Review",
    "author": {"@type": "Person", "name": "Sarah"},
    "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
    "reviewBody": "Vraiment à l'écoute. Ça m'a aidée à prendre du recul."
  },
  {
    "@type": "Review",
    "author": {"@type": "Person", "name": "Julie"},
    "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
    "reviewBody": "J'hésitais sur un choix pro depuis des semaines. Sa réponse m'a débloquée."
  },
  {
    "@type": "Review",
    "author": {"@type": "Person", "name": "Océane"},
    "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
    "reviewBody": "Trouvée sur TikTok. Réponse reçue en quelques heures, détaillée et bienveillante."
  },
  {
    "@type": "Review",
    "author": {"@type": "Person", "name": "Manon"},
    "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
    "reviewBody": "Pour 1€ franchement rien à dire. Rapide, clair, et un petit mot perso en plus."
  }
]
```

---

### Schema — Person (Laura) enrichi

Remplacer le bloc Person existant dans `/a-propos` :

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://www.auraintuitive.fr/a-propos#laura",
  "name": "Laura",
  "givenName": "Laura",
  "url": "https://www.auraintuitive.fr/a-propos",
  "jobTitle": "Voyante intuitive",
  "description": "Médium et voyante intuitive depuis l'enfance, Laura propose des consultations de guidance spirituelle par email via Aura Intuitive, accessibles dès 1€.",
  "worksFor": {
    "@type": "ProfessionalService",
    "name": "Aura Intuitive",
    "url": "https://www.auraintuitive.fr"
  },
  "knowsAbout": [
    "voyance", "guidance spirituelle", "intuition", "médiumnité",
    "voyance amoureuse", "retour d'ex", "flamme jumelle"
  ],
  "sameAs": [
    "https://www.tiktok.com/@aura_intuitive"
  ]
}
```

---

### Schema — BlogPosting template (à appliquer à tous les articles)

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "[TITRE DE L'ARTICLE]",
  "description": "[META DESCRIPTION 150-160 CHARS]",
  "image": {
    "@type": "ImageObject",
    "url": "https://www.auraintuitive.fr/[CHEMIN IMAGE 1200x630px]",
    "width": 1200,
    "height": 630
  },
  "author": {
    "@type": "Person",
    "@id": "https://www.auraintuitive.fr/a-propos#laura",
    "name": "Laura",
    "url": "https://www.auraintuitive.fr/a-propos"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Aura Intuitive",
    "url": "https://www.auraintuitive.fr",
    "logo": {
      "@type": "ImageObject",
      "url": "https://www.auraintuitive.fr/[LOGO RECTANGULAIRE 600x60px]",
      "width": 600,
      "height": 60
    }
  },
  "datePublished": "[DATE ISO 8601]",
  "dateModified": "[DATE MODIFICATION ISO 8601]",
  "url": "https://www.auraintuitive.fr/blog/[SLUG]",
  "inLanguage": "fr",
  "articleSection": "[Voyance amoureuse | Voyance travail | Conseils pratiques]",
  "wordCount": "[NOMBRE DE MOTS]",
  "keywords": "[MOT-CLÉ-1, MOT-CLÉ-2, MOT-CLÉ-3]",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": ["h1", ".article-intro", ".article-summary"]
  }
}
```

---

## Analyse par plateforme IA

| Plateforme | Score | Requêtes potentielles | Barrière principale |
|---|---|---|---|
| Google AI Overviews | 44/100 | "voyance 1 euro serieuse", "voyance par email comment ça marche" | Pas d'AggregateRating, pas d'HowTo schema |
| ChatGPT Web Search | 35/100 | "voyance par email sérieuse France" | Zéro présence Wikipedia/Wikidata |
| Perplexity AI | 40/100 | "voyance sans abonnement France" | Zéro Reddit, zéro Trustpilot |
| Google Gemini | 42/100 | "voyance en ligne sérieuse pas chère" | Pas de YouTube, sameAs incomplet |
| Bing Copilot | 44/100 | "consultation voyance 1 euro sérieuse" | Pas de LinkedIn, pas de Bing WMT |

---

## Feuille de route (ordre d'exécution recommandé)

### Semaine 1 — Conformité & Quick Wins
1. Page Mentions Légales
2. Bandeau RGPD + politique cookies
3. Profil Trustpilot (créer + envoyer demande d'avis aux clients)
4. Réécrire llms.txt (template ci-dessus)
5. Ajouter directives IA dans robots.txt (5 lignes)
6. Ajouter AggregateRating dans le schema homepage
7. Ajouter `image` dans tous les BlogPosting schemas
8. Ajouter `width` et `height` sur toutes les images

### Semaine 2 — Autorité & Confiance
9. Enrichir la page À propos (cas concrets, méthodologie, politique satisfaction)
10. Créer page LinkedIn entreprise
11. Créer page CGV / politique de remboursement
12. Créer page `/faq` autonome
13. Améliorer meta descriptions courtes
14. Vérifier security headers (curl -I)
15. Ajouter balises Open Graph

### Mois 1-3 — Autorité externe
16. Obtenir 2+ mentions presse française (prérequis Wikipedia)
17. Créer entrée Wikidata
18. Lancer chaîne YouTube
19. Amorcer présence Reddit (authentique)
20. Publier article avec données originales

---

*Rapport généré par Claude Code GEO Audit — 5 agents spécialisés — 16 mars 2026*
