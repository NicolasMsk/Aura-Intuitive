# Design — Version anglaise du site Aura Intuitive

**Date** : 2026-05-22
**Auteur** : Claude (validé par Nicolas)
**Statut** : Design approuvé — en attente de relecture finale avant plan d'implémentation

---

## 1. Objectif

Rendre le site Aura Intuitive accessible aux visiteurs anglophones : pages publiques traduites, SEO international, paiement et email de réponse en anglais quand le client vient de la version EN.

## 2. Choix structurants (validés)

| Sujet | Décision |
|---|---|
| Structure URL | Sous-dossier `/en/` (pas de sous-domaine, pas de JS switcher) |
| Pages traduites | **Toutes** les pages publiques (~26 pages incluant 20 articles blog) |
| Paiement | Mêmes Payment Links Stripe (EUR), clonés dans Dashboard avec redirection EN |
| Devise affichée | `€` (cohérent avec Stripe ; Stripe gère la conversion bancaire) |
| Langue emails | Auto selon `lang` stockée en DB |
| Traduction | Faite par Claude (anglais professionnel, ton spirituel/voyance) |
| Admin panel | **Non modifié** — l'admin reconnaît la langue à la question reçue |

## 3. Approche technique : duplication statique

Option retenue : **dupliquer les fichiers HTML traduits sous `public/en/`**.

**Pourquoi :**
- Le site est déjà 100 % statique côté front (Express ne fait que servir des fichiers)
- SEO parfait : chaque langue = vraie URL indexable par Google
- Zéro dépendance ajoutée, zéro refonte du serveur
- Le coût (duplication HTML) est ponctuel ; les modifs futures de structure seront rares

**Alternatives écartées :**
- *Templating serveur (EJS/Handlebars + JSON i18n)* : refonte importante du flow Express pour un gain marginal
- *Switch JS côté client* : mauvais SEO (Google indexe la langue par défaut uniquement)

## 4. Architecture des fichiers

```
public/
├── index.html              # FR (inchangé)
├── a-propos.html
├── mentions-legales.html
├── form.html
├── merci.html
├── already-submitted.html
├── sitemap.xml             # mis à jour avec URLs /en/
├── llms.txt                # enrichi section EN
├── style.css               # inchangé (réutilisé)
├── script.js               # inchangé (réutilisé)
├── blog/
│   ├── index.html
│   └── [20 articles FR].html
└── en/                     # NOUVEAU
    ├── index.html
    ├── about.html
    ├── legal.html
    ├── form.html
    ├── thank-you.html
    ├── already-submitted.html
    └── blog/
        ├── index.html
        └── [20 articles EN, slugs anglais].html
```

**Slugs blog EN** : traduits en anglais SEO-friendly. Exemples :
- `voyance-1-euro-serieuse.html` → `cheap-psychic-reading-1-euro.html`
- `flamme-jumelle-ame-soeur-difference.html` → `twin-flame-soulmate-difference.html`
- `mon-ex-va-t-il-revenir-voyance.html` → `will-my-ex-come-back-psychic.html`
- (liste complète à finaliser dans le plan d'implémentation)

## 5. Switcher de langue

Bouton discret dans le header de chaque page :

```html
<div class="lang-switcher">
  <a href="/a-propos.html" class="active">🇫🇷 FR</a>
  <span>|</span>
  <a href="/en/about.html">🇬🇧 EN</a>
</div>
```

Chaque page connaît son équivalent dans l'autre langue (lien direct codé en dur, pas de redirection serveur).

## 6. SEO international

### Balises `hreflang` (dans `<head>` de chaque page)

Exemple pour `a-propos.html` :
```html
<link rel="alternate" hreflang="fr" href="https://aura-intuitive.com/a-propos.html">
<link rel="alternate" hreflang="en" href="https://aura-intuitive.com/en/about.html">
<link rel="alternate" hreflang="x-default" href="https://aura-intuitive.com/">
```

### `sitemap.xml`

Ajouter toutes les URLs `/en/*` avec annotations `xhtml:link` pour les alternates linguistiques.

### `llms.txt`

Enrichir avec une section dédiée "English version" listant les URLs EN principales.

### `robots.txt`

Aucune modification nécessaire (autorise déjà tout le contenu public).

## 7. Backend (modifications minimales)

### `schema.sql`

```sql
ALTER TABLE consultations
  ADD COLUMN lang TEXT NOT NULL DEFAULT 'fr'
  CHECK (lang IN ('fr', 'en'));
```

### `src/server.ts`

Trois modifications ciblées (~30 lignes au total) :

1. **Endpoint de soumission du formulaire** : accepter le champ `lang` envoyé par le form (valeur `'fr'` ou `'en'`) → stocker dans la DB.
2. **Endpoint de réponse admin** : lire `consultation.lang` → sélectionner le template email correspondant.
3. **Fonctions templates email** : ajouter `confirmationEmailEN()` et `responseEmailEN()` à côté des versions FR existantes.

### `form.html` (FR) et `en/form.html` (EN)

Ajouter un champ caché :
```html
<input type="hidden" name="lang" value="fr">  <!-- ou "en" dans /en/form.html -->
```

## 8. Workflow client anglophone (end-to-end)

1. Le client arrive sur `aura-intuitive.com/en/` (via SEO, pub, lien direct)
2. Il navigue dans la version EN, clique sur un service
3. Bouton "Order" → redirige vers le **Payment Link EN cloné dans Stripe**
4. Paiement Stripe (en EUR, conversion gérée par sa banque)
5. Stripe redirige vers `https://aura-intuitive.com/en/form.html?session_id={CHECKOUT_SESSION_ID}&lang=en`
6. Client remplit son formulaire en anglais → POST `/api/submit` avec `lang=en`
7. DB : ligne créée avec `lang='en'`
8. **Email de confirmation envoyé automatiquement en anglais** (template EN)
9. Admin voit la consultation dans `/admin`, lit la question (en anglais), rédige sa réponse en anglais, clique "Envoyer"
10. **Email de réponse envoyé en anglais** (template EN, sélectionné via `consultation.lang`)

## 9. Configuration Stripe (action manuelle utilisateur)

Pour chaque Payment Link existant (FR), créer un clone EN dans Stripe Dashboard :

1. Dashboard → Payment Links → `...` → **Duplicate**
2. Renommer (ex: `Voyance express — EN`)
3. **After payment** → **Redirect customers to your website**
4. URL de redirection :
   ```
   https://aura-intuitive.com/en/form.html?session_id={CHECKOUT_SESSION_ID}&lang=en
   ```
   (`{CHECKOUT_SESSION_ID}` est un placeholder Stripe — à coller littéralement)
5. Sauvegarder, copier l'URL du Payment Link
6. Cette URL sera utilisée dans `public/en/index.html` (boutons "Order")

## 10. Traductions

Toutes les traductions seront produites par Claude :
- Ton : professionnel, spirituel, chaleureux (cohérent avec la version FR)
- Adaptation culturelle : terminologie anglo-saxonne de la voyance (`psychic reading`, `tarot`, `clairvoyance`, `twin flame`, etc.)
- Préservation des éléments SEO : titres `<h1>`, meta descriptions, alt tags
- Slugs URL : anglais SEO-friendly, indépendants de la version FR

## 11. Périmètre exclu (hors scope)

- ❌ Pages admin / dashboard (`admin.html`, `dashboard.html`) — usage interne, FR uniquement
- ❌ Détection automatique de la langue navigateur — utilisateur choisit via switcher
- ❌ Affichage des prix en USD ou GBP — on garde EUR
- ❌ Service worker (`sw.js`) — pas de comportement langue-spécifique
- ❌ Refonte structure HTML / CSS / JS

## 12. Livrables

| Type | Quantité | Notes |
|---|---|---|
| Pages HTML traduites | 26 | 6 principales + 1 blog index + 19 articles |
| Modifications HTML FR | ~26 | Ajout switcher + balises `hreflang` |
| Migration SQL | 1 | Ajout colonne `lang` |
| Modifs `server.ts` | ~30 lignes | Submit + response endpoints + 2 templates email |
| Sitemap mis à jour | 1 | Avec alternates linguistiques |
| `llms.txt` enrichi | 1 | Section EN |
| Action manuelle (utilisateur) | N Payment Links | Clonage dans Stripe Dashboard |

## 13. Critères de succès

- [ ] Toutes les pages `/en/*` sont accessibles et traduites
- [ ] Le switcher FR/EN fonctionne dans les deux sens sur chaque page
- [ ] Google peut indexer les deux versions (vérifié via balises `hreflang` et sitemap)
- [ ] Un client cliquant sur "Order" depuis `/en/` est redirigé vers le Payment Link EN
- [ ] Après paiement, redirection vers `/en/form.html` avec `lang=en`
- [ ] La DB stocke `lang='en'` pour la consultation
- [ ] L'email de confirmation arrive en anglais
- [ ] L'email de réponse (envoyé depuis admin) arrive en anglais
- [ ] Les clients francophones ne voient aucun changement de comportement
