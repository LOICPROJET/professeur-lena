# 👧 Professeur Léna

Application mobile d'aide aux devoirs pour enfants de 10 ans (CM1-CM2).  
L'enfant prend son devoir en photo → l'IA le corrige avec bienveillance → les parents suivent les progrès.

---

## 1. Lancer en local

### Prérequis
- Node.js ≥ 18
- Un compte OpenAI avec une clé API ([platform.openai.com/api-keys](https://platform.openai.com/api-keys))

### Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Créer le fichier de configuration
cp .env.example .env.local
```

Ouvre `.env.local` et renseigne tes variables :

```
OPENAI_API_KEY=sk-ta-cle-ici
PARENT_CODE=1234
```

### Démarrage

```bash
npm run dev
```

L'application est disponible sur **http://localhost:3000**

### Accès depuis un iPhone (même réseau Wi-Fi)

```bash
# Lance le serveur en écoutant sur toutes les interfaces
npm run dev -- --hostname 0.0.0.0
```

Trouve l'adresse IP de ton Mac :

```bash
# Dans un autre terminal
ipconfig getifaddr en0
# Exemple : 192.168.1.42
```

Sur l'iPhone, ouvre **Safari** → `http://192.168.1.42:3000`

---

## 2. Déployer sur Vercel

### Étape 1 — Pousser sur GitHub

```bash
git init
git add .
git commit -m "feat: Professeur Léna v2"
# Crée un repo sur github.com, puis :
git remote add origin https://github.com/ton-compte/professeur-lena.git
git push -u origin main
```

> Le fichier `.env.local` n'est **jamais** commité (il est dans `.gitignore` de Next.js).

### Étape 2 — Importer sur Vercel

1. Va sur [vercel.com/new](https://vercel.com/new)
2. Clique **"Add New Project"** → **"Import Git Repository"**
3. Sélectionne ton repo `professeur-lena`
4. Vercel détecte automatiquement Next.js — laisse les paramètres par défaut

### Étape 3 — Configurer les variables d'environnement

Dans **Project Settings → Environment Variables**, ajoute :

| Nom | Valeur | Environnements |
|---|---|---|
| `OPENAI_API_KEY` | `sk-ta-cle-ici` | Production, Preview, Development |
| `PARENT_CODE` | `1234` | Production, Preview, Development |

> ⚠️ Ces variables restent **côté serveur uniquement** — elles ne sont jamais envoyées au navigateur.

### Étape 4 — Déployer

Clique **"Deploy"**. Vercel construit et déploie en ~2 minutes.

Ton application est en ligne sur `https://professeur-lena.vercel.app` (ou l'URL personnalisée de ton choix).

### Re-déploiements automatiques

Chaque `git push` sur `main` déclenche un nouveau déploiement automatiquement.

---

## 3. Ajouter l'application sur l'écran d'accueil iPhone

Une fois déployée sur Vercel (ou lancée en local), l'app peut fonctionner comme une app native sur iPhone.

**Étapes :**

1. Ouvre **Safari** sur l'iPhone (pas Chrome — Safari est requis pour cette fonctionnalité)
2. Navigue vers l'URL Vercel : `https://professeur-lena.vercel.app`
3. Appuie sur l'icône **Partager** (carré avec une flèche vers le haut, en bas de l'écran)
4. Fais défiler et appuie sur **"Sur l'écran d'accueil"**
5. Nomme l'app **"Léna"** → appuie sur **"Ajouter"**

L'icône violette apparaît sur l'écran d'accueil. En l'ouvrant, l'app se lance en plein écran sans la barre Safari — comme une vraie application.

---

## 4. Structure du projet

```
professeur-lena/
├── app/
│   ├── layout.tsx                    # Layout racine + meta PWA
│   ├── page.tsx                      # Écran accueil, photo, résultats
│   ├── globals.css                   # Styles globaux + animations
│   ├── history/
│   │   └── page.tsx                  # Historique des devoirs
│   ├── parent/
│   │   └── page.tsx                  # Dashboard parent (protégé par PIN)
│   └── api/
│       ├── correct-homework/
│       │   └── route.ts              # → OpenAI Vision GPT-4o
│       └── verify-pin/
│           └── route.ts              # Vérifie le PIN parent côté serveur
├── components/
│   ├── BottomNav.tsx                 # Navigation bas de page partagée
│   ├── CameraCapture.tsx             # Bouton photo + galerie
│   ├── SubjectSelector.tsx           # Sélection de matière
│   └── ResultCards.tsx               # Cartes de correction + score
├── lib/
│   ├── types.ts                      # Types TypeScript partagés
│   └── storage.ts                    # localStorage + calcul des stats
├── public/
│   ├── manifest.json                 # Manifest PWA
│   ├── icon-192.png                  # Icône PWA 192×192
│   ├── icon-512.png                  # Icône PWA 512×512
│   └── apple-touch-icon.png          # Icône iPhone 180×180
├── .env.example                      # Template des variables d'environnement
├── vercel.json                       # Config Vercel (timeout, headers)
├── next.config.js                    # Config Next.js (body size 10 MB)
└── README.md
```

---

## 5. Sécurité

| Élément | Statut |
|---|---|
| `OPENAI_API_KEY` | ✅ Serveur uniquement (`app/api/`) |
| `PARENT_CODE` | ✅ Serveur uniquement (`app/api/verify-pin`) |
| Données enfant | ✅ Stockées localement dans le navigateur (localStorage) |
| Données transmises | ✅ Image envoyée uniquement à OpenAI via le serveur |

---

## 6. Changer le code PIN parent

### En local
Dans `.env.local` :
```
PARENT_CODE=5678
```

### Sur Vercel
Project Settings → Environment Variables → modifier `PARENT_CODE` → Re-déployer.
