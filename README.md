# ✦ Aura Intuitive

Site de voyance & guidance spirituelle avec paiement sécurisé et gestion des consultations.

## 🏗️ Architecture

| Composant | Technologie |
|-----------|-------------|
| Backend   | Express.js (TypeScript) |
| Base de données | Supabase (PostgreSQL) |
| Paiements | Stripe (Payment Links + Webhooks) |
| Emails    | Resend (noreply) |
| Hébergement | Railway |

## 📁 Structure du projet

```
├── src/
│   ├── server.ts          # Serveur Express principal
│   └── types.ts           # Types TypeScript
├── public/
│   ├── index.html         # Landing page
│   ├── form.html          # Formulaire post-paiement
│   ├── already-submitted.html
│   ├── admin.html         # Panel admin
│   ├── style.css          # Styles (thème bordeaux)
│   └── script.js          # Animations frontend
├── schema.sql             # Schéma Supabase
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## 🔄 Parcours utilisateur

1. Le client visite le site et choisit un service
2. Il paye via Stripe (Payment Link)
3. Stripe redirige vers `/form?session_id=...`
4. Le client remplit le formulaire avec sa question
5. **L'admin** se connecte sur `/admin`
6. Elle rédige sa réponse et clique « Envoyer »
7. Le client reçoit la réponse par email

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/NicolasMsk/Aura-Intuitive.git
cd Aura-Intuitive
npm install
```

### 2. Configurer l'environnement

Copier `.env.example` → `.env` et remplir les valeurs :

```bash
cp .env.example .env
```

### 3. Créer la base Supabase

- Aller sur [supabase.com](https://supabase.com) → ouvrir votre projet
- Ouvrir **SQL Editor**
- Coller le contenu de `schema.sql` et exécuter

### 4. Configurer Stripe

#### Payment Links

Dans Stripe Dashboard → **Payment Links**, pour chaque lien :
- Aller dans les paramètres du lien
- **After payment** → Redirect to : `https://VOTRE_DOMAINE/form?session_id={CHECKOUT_SESSION_ID}`

#### Webhook

Dans Stripe Dashboard → **Developers** → **Webhooks** :
1. Ajouter un endpoint : `https://VOTRE_DOMAINE/api/webhook`
2. Événement à écouter : `checkout.session.completed`
3. Copier le **Signing Secret** dans `.env` → `STRIPE_WEBHOOK_SECRET`

### 5. Configurer Resend

- Créer un compte sur [resend.com](https://resend.com)
- Ajouter et vérifier votre domaine
- Copier l'API Key dans `.env` → `RESEND_API_KEY`

### 6. Lancer en développement

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000`.

### 7. Déployer sur Railway

```bash
# Pousser sur GitHub
git add -A
git commit -m "deploy"
git push

# Sur railway.app :
# 1. New Project → Deploy from GitHub
# 2. Ajouter les variables d'environnement depuis .env
# 3. Build command : npm run build
# 4. Start command : npm start
```

## 🛠️ Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarre le serveur en mode développement (hot reload) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Démarre le serveur compilé (production) |

## 📧 Variables d'environnement

| Variable | Description |
|----------|-------------|
| `PORT` | Port du serveur (défaut: 3000) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_KEY` | Clé service Supabase |
| `RESEND_API_KEY` | Clé API Resend |
| `EMAIL_FROM` | Adresse d'envoi (ex: `Aura Intuitive <noreply@votre-domaine.com>`) |
| `ADMIN_PASSWORD` | Mot de passe pour le panel admin |
| `APP_URL` | URL publique du site |
