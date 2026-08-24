docker compose cp pandorahearts_backup_2026-02-24_1758.sql postgres:/tmp/pandorahearts_backup_2026-02-24_1758.sql
docker compose exec -T postgres sh -lc 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -f /tmp/pandorahearts_backup_2026-02-24_1758.sql'

# Faire un backup
mkdir -p backups

docker compose exec -T postgres sh -lc \
'pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" --clean --if-exists --no-owner --no-privileges' \
> backups/pandorahearts_$(date +%F_%H-%M-%S).sql

# Faire un restore
FILE="backups/TON_FICHIER.sql"

docker compose exec -T postgres sh -lc \
'psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"' \
< "$FILE"




# PandoraHearts Family

Dashboard web pour suivre la famille **PandoraHearts** sur **NosTale** avec historique de GEXP, vues joueur, classement mensuel, gestion des rôles (principale / secondaire / mule), suivi des statuts, import de snapshots et outils d’administration.

---

## 1. Vue d’ensemble

Le projet est une application full-stack composée de :

- **Frontend** : React + Vite + Tailwind + Recharts
- **Backend** : FastAPI + SQLAlchemy
- **Base de données** : PostgreSQL
- **Déploiement local** : Docker Compose
- **Déploiement Git** : GitHub Pages pour le frontend, Argo CD prévu côté Kubernetes mais actuellement partiellement générique / à adapter

L’objectif fonctionnel est de :

- stocker des **snapshots** datés de points GEXP,
- calculer les évolutions sur plusieurs périodes,
- afficher des vues famille / historique / joueur,
- gérer des métadonnées de joueurs :
  - rôle,
  - statut,
  - rattachement au personnage principal,
- fournir des **actions d’admin** :
  - import de fichiers `gmbr` / `gexp`,
  - renommage,
  - modification de rôle,
  - modification de points,
  - suppression,
  - suivi des dons.

---

## 2. Arborescence du dépôt

```text
.
├── .github/workflows/deploy.yml
├── backend/
│   ├── api/
│   │   ├── auth.py
│   │   ├── db.py
│   │   ├── importer.py
│   │   ├── main.py
│   │   └── models.py
│   ├── scripts/
│   │   ├── 001_members_role_link.sql
│   │   └── run_migrations.py
│   ├── Dockerfile
│   └── requirements.txt
├── deploy/
│   └── argocd/
│       └── app.yaml
├── frontend/
│   ├── nginx/
│   │   └── default.conf
│   ├── public/
│   │   └── classes/
│   │       └── images statiques des classes / logo
│   ├── src/
│   │   ├── components/
│   │   │   └── EvolutionChart.jsx
│   │   ├── constants/
│   │   │   └── classes.js
│   │   ├── pages/
│   │   │   ├── AdminImport.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Donations.jsx
│   │   │   ├── HistoryDashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── MembersPage.jsx
│   │   │   └── PlayerDashboard.jsx
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── auth.js
│   │   ├── index.css
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── .env.example
├── .gitignore
├── docker-compose.yml
├── pandorahearts_backup_2026-02-24_1758.sql
└── README.md
```

---

## 3. Fonctionnement métier

### 3.1 Entités métier

Le projet manipule principalement 3 types de données :

#### `Member`
Représente un personnage de la famille.

Champs importants :

- `player_id`
- `account_id`
- `nickname`
- `level`
- `class_id`
- `family`
- `status` : `actif`, `absent`, `arret_sans_nouvelle`, ou `NULL`
- `role` : `Principale`, `Secondaire`, `Mule`, ou `NULL`
- `main_player_id` : lien vers le personnage principal si le joueur est secondaire ou mule

#### `WeeklyPoints`
Représente une valeur de GEXP pour un joueur à une date donnée.

Champs importants :

- `snapshot_date`
- `imported_at`
- `family`
- `player_id`
- `gexp_points`

#### `Donation`
Représente l’état de participation d’un personnage principal aux dons.

Champs importants :

- `player_id`
- `family`
- `gave`
- `amount`

---

### 3.2 Logique de snapshots

Le backend stocke des snapshots datés.  
Chaque snapshot correspond à un import de fichiers `gmbr` et `gexp`.

- `gmbr` sert à créer / mettre à jour les membres.
- `gexp` sert à créer les lignes de points pour la date ciblée.
- Si un snapshot existe déjà pour une date donnée, il est **remplacé** avant réimport.

Cela permet de recalculer ensuite :

- le total final,
- le delta de période,
- le delta hebdomadaire,
- le delta mensuel sur 4 semaines.

---

### 3.3 Périodes utilisées

Le projet utilise plusieurs notions de période :

#### Historique libre
Sur la page Historique, l’utilisateur choisit un `from_date` et un `to_date`.

#### Hebdomadaire
Le delta hebdomadaire est calculé entre le dernier snapshot visible et le snapshot global précédent.

#### Mensuel / 4 semaines
Le projet utilise une logique de **28 jours**.

Deux variantes coexistent dans le frontend :

- certaines pages calculent une **fenêtre fixe** de 28 jours ancrée au `2026-01-25`,
- le backend calcule plutôt une **référence de snapshot à 28 jours** avant la dernière date disponible.

C’est important à savoir pour éviter des incompréhensions lors d’une future refonte.

---

## 4. Backend

### 4.1 Stack

- FastAPI
- SQLAlchemy
- PostgreSQL via `psycopg2-binary`
- JWT pour l’authentification

### 4.2 Démarrage

Le conteneur backend :

1. installe les dépendances Python,
2. copie `api/` et `scripts/`,
3. exécute `python -u scripts/run_migrations.py`,
4. lance `uvicorn api.main:app --host 0.0.0.0 --port 8000`

---

### 4.3 Authentification

L’auth est gérée dans `backend/api/auth.py`.

Caractéristiques :

- JWT signé en `HS256`
- expiration par défaut : **720 minutes**
- 2 comptes statiques chargés via variables d’environnement :
  - `Droken` → rôle `superadmin`
  - `Admin` → rôle `admin`

Le mot de passe est hashé en SHA256 avec un `PASSWORD_SALT`.

> Important : c’est simple et pratique pour un usage perso/admin, mais ce n’est pas un système multi-utilisateur complet.

---

### 4.4 Routes backend

#### Santé
- `GET /health`

#### Auth
- `POST /auth/login`
- `GET /auth/me`

#### Import
- `POST /family/{family}/import`

#### Consultation publique
- `GET /family/{family}/latest`
- `GET /family/{family}/snapshots`
- `GET /family/{family}/history`
- `GET /family/{family}/player/by-nickname/{nickname}`
- `GET /family/{family}/mains`

#### Admin
- `PATCH /family/{family}/player/{player_id}/nickname`
- `PATCH /family/{family}/players/{player_id}/points`
- `DELETE /family/{family}/players/{player_id}`
- `PATCH /family/{family}/player/{player_id}/role-link`
- `PATCH /family/{family}/player/{player_id}/status`
- `GET /family/{family}/donations`
- `PUT /family/{family}/donations/{player_id}`

---

### 4.5 Ce que fait chaque fichier backend

#### `backend/api/main.py`
Fichier principal FastAPI.  
Il contient :

- la création de l’app,
- la config CORS,
- le bootstrap DB au startup,
- les routes d’auth,
- les routes d’import,
- les endpoints publics,
- les endpoints admin,
- les helpers métier (`normalize_role`, `normalize_status`, logique de référence mensuelle, etc.).

#### `backend/api/auth.py`
Gère :

- le hash des mots de passe,
- l’authentification des 2 comptes fixes,
- la génération de JWT,
- la lecture du token,
- les dépendances d’autorisation (`require_roles`).

#### `backend/api/db.py`
Construit `DATABASE_URL`, initialise l’engine SQLAlchemy, la session factory, et fournit `get_db()`.

#### `backend/api/models.py`
Déclare les modèles SQLAlchemy :

- `Member`
- `WeeklyPoints`
- `Donation`

ainsi que leurs contraintes :

- unicité `family + nickname`,
- unicité `snapshot_date + family + player_id`,
- contraintes sur `role`,
- auto-référence `main_player_id`.

#### `backend/api/importer.py`
Parse les contenus `gmbr` et `gexp`, met à jour / crée les membres, supprime le snapshot existant pour la date, puis insère les nouvelles lignes `WeeklyPoints`.

#### `backend/scripts/001_members_role_link.sql`
Migration SQL destinée à ajouter `role` et `main_player_id` sur `members`.

⚠️ **Attention** : cette migration utilise encore des valeurs anglaises (`main`, `secondary`, `mule`) alors que le code applicatif utilise des valeurs françaises (`Principale`, `Secondaire`, `Mule`).  
Il y a donc un **écart de modèle** à corriger ou documenter avant toute nouvelle migration.

#### `backend/scripts/run_migrations.py`
Le Dockerfile l’exécute avant `uvicorn`.  
Son contenu n’a pas pu être exploité clairement depuis l’outil de lecture, donc il faudra vérifier localement s’il est vide, incomplet, ou simplement mal renvoyé par l’outil.

#### `backend/requirements.txt`
Dépendances Python minimales du backend.  
À noter :

- `python-multipart` est listé **deux fois**,
- aucune version n’est figée.

#### `backend/Dockerfile`
Image simple basée sur `python:3.12-slim`, conçue pour lancer le backend FastAPI en conteneur.

---

## 5. Frontend

### 5.1 Stack

- React 18
- React Router
- Vite
- Tailwind CSS
- Recharts

### 5.2 Entrée applicative

#### `frontend/src/main.jsx`
Monte l’application React dans `#root`.

#### `frontend/src/App.jsx`
Déclare :

- le `BrowserRouter`,
- la shell de navigation,
- les routes de l’application,
- le composant `Protected` pour les pages admin.

Routes présentes :

- `/` → Dashboard
- `/history` → Historique
- `/player/:nickname` → Fiche joueur
- `/login` → Connexion
- `/admin/import` → Import admin
- `/members` → Liste des membres
- `/donations` → Suivi des dons

---

### 5.3 Auth frontend

#### `frontend/src/auth.js`
Gère le stockage local de :

- `ph_token`
- `ph_user`

et expose :

- `saveAuth`
- `clearAuth`
- `getToken`
- `getUser`
- `isAllowed`

L’accès admin est autorisé pour les rôles `admin` et `superadmin`.

---

### 5.4 API frontend

#### `frontend/src/api.js`
Expose `API_BASE`.

Par défaut :

```js
https://api.pandorahearts-family.fr
```

Cela signifie que le frontend appelle directement l’API distante si `VITE_API_BASE` n’est pas défini.

---

### 5.5 Pages frontend

#### `Dashboard.jsx`
Page d’accueil / classement mensuel.

Fonctions principales :

- charge les snapshots,
- calcule une période fixe de 4 semaines,
- récupère `/history`,
- filtre les membres,
- conserve uniquement les rôles `Principale`,
- trie par `monthly_diff`, puis `weekly_diff`,
- affiche :
  - statistiques globales,
  - top 3,
  - tableau du classement,
  - lien vers `/members`.

#### `HistoryDashboard.jsx`
Vue historique globale.

Fonctions principales :

- charge les snapshots,
- permet de choisir `from_date` / `to_date`,
- appelle `/history`,
- propose recherche et tri,
- affiche un tableau large avec colonnes sticky,
- montre :
  - les points par date,
  - le delta de période,
  - le delta hebdo,
  - le delta mensuel.

#### `PlayerDashboard.jsx`
Vue détaillée d’un joueur.

Fonctions principales :

- charge les snapshots disponibles,
- appelle `/player/by-nickname/{nickname}`,
- affiche :
  - infos joueur,
  - classe,
  - niveau,
  - rôle,
  - principal lié,
  - stats calculées,
  - graphique d’évolution,
  - tableau chronologique,
  - personnages liés si le joueur est `Principale`.

Fonctions admin intégrées :

- renommage,
- changement de rôle / rattachement,
- suppression du personnage,
- modification ponctuelle des points d’un snapshot,
- réimport de snapshot depuis la page.

#### `Login.jsx`
Formulaire de connexion admin.  
Envoie `username` / `password` en `FormData` sur `/auth/login`, puis stocke le token.

#### `AdminImport.jsx`
Interface admin dédiée à l’import :

- date,
- fichier `gmbr`,
- fichier `gexp`,
- appel `POST /family/{family}/import?snapshot_date=...`

#### `MembersPage.jsx`
Table détaillée de tous les membres.

Fonctions principales :

- récupère les snapshots,
- calcule une fenêtre fixe de 4 semaines,
- appelle `/history`,
- trie les membres par rôle,
- affiche :
  - pseudo,
  - statut,
  - rôle,
  - principal lié,
  - dernier GEXP,
  - delta hebdo,
  - delta 4 semaines.

Fonctions admin :

- édition inline du pseudo,
- édition du statut,
- édition du rôle,
- édition du principal lié.

#### `Donations.jsx`
Page admin de suivi des dons des personnages principaux.

Fonctions principales :

- charge `/mains`,
- charge `/donations`,
- permet :
  - de cocher “a donné”,
  - de saisir un montant,
  - de recalculer le total,
  - de reset tous les dons.

---

### 5.6 Composants frontend

#### `components/EvolutionChart.jsx`
Composant graphique basé sur Recharts.

Modes :

- `total` : courbe cumulée
- `delta` : histogramme des gains entre snapshots

Fonctions utiles :

- formatage FR des dates,
- calcul des deltas successifs,
- brush de zoom activable,
- couleurs adaptées au thème sombre.

---

### 5.7 Constantes & assets

#### `constants/classes.js`
Mapping des classes NosTale :

- `1` → Escrimeur
- `2` → Archer
- `3` → Mage
- `4` → Artiste Martial
- `0` → Aventurier

et chemins vers les icônes dans `/public/classes`.

#### `public/classes/`
Répertoire d’assets statiques :

- icônes des classes,
- logo de l’application.

---

### 5.8 Fichiers de build frontend

#### `frontend/Dockerfile`
Build Vite dans une image Node, puis sert les fichiers avec Nginx.

#### `frontend/nginx/default.conf`
Config Nginx SPA :

- `try_files ... /index.html`
- cache long pour les assets statiques
- proxy `/api/` vers `https://api.pandorahearts-family.fr/`

⚠️ À noter : le frontend utilise aujourd’hui un `API_BASE` absolu côté JS, donc ce proxy `/api/` n’est pas la mécanique principale réellement exploitée.

#### `frontend/index.html`
Point d’entrée HTML avec `#root` et favicon.

#### `frontend/package.json`
Scripts Vite :

- `dev`
- `build`
- `preview`

#### `frontend/tailwind.config.js`
Config Tailwind minimale.

#### `frontend/vite.config.js`
Config Vite de base, `base: "/"`.

#### `frontend/postcss.config.js`
Présent dans l’arborescence du projet, mais non inspecté précisément via l’outil.  
À garder comme fichier d’infrastructure CSS standard.

#### `frontend/package-lock.json`
Lockfile npm.  
Pas pertinent pour comprendre la logique métier, mais utile pour la reproductibilité.

---

## 6. Infrastructure et déploiement

### 6.1 Docker Compose

Le `docker-compose.yml` déclare 3 services :

- `postgres`
- `backend`
- `frontend`

#### `postgres`
- image `postgres:16`
- volume `pgdata`
- healthcheck `pg_isready`

#### `backend`
- build local `./backend`
- port exposé `8000:8000`
- dépend de `postgres`
- récupère les secrets / variables d’env via `.env`

#### `frontend`
- build local `./frontend`
- port exposé `3001:80`
- dépend du backend

---

### 6.2 GitHub Actions

`.github/workflows/deploy.yml` déploie le frontend sur **GitHub Pages** lors d’un push sur `main`.

Étapes :

1. checkout
2. setup Node 20
3. `npm ci`
4. `npm run build`
5. upload artifact Pages
6. deploy Pages

Le build lit `VITE_API_BASE` depuis les variables GitHub Actions.

---

### 6.3 Argo CD

`deploy/argocd/app.yaml` existe, mais il est actuellement **générique / non finalisé** :

- `repoURL` pointe encore vers `https://github.com/TON_GITHUB/pandorahearts.git`
- `path` pointe vers `deploy/k8s`
- or le dépôt inspecté contient `deploy/argocd`, pas `deploy/k8s`

Donc ce manifest n’est pas encore aligné avec l’état réel du repo.

---

## 7. Variables d’environnement

Le projet attend au minimum :

```env
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=

JWT_SECRET=
PASSWORD_SALT=

DROKEN_PASSWORD=
ADMIN_PASSWORD=
```

Variables utiles supplémentaires selon le contexte :

```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=
DATABASE_URL=

JWT_EXPIRE_MINUTES=720
VITE_API_BASE=https://api.pandorahearts-family.fr
```

⚠️ Le fichier `.env.example` n’a pas pu être exploité via l’outil et semble vide ou non significatif.  
Il serait utile de le compléter proprement.

---

## 8. Lancer le projet en local

### 8.1 Préparer `.env`

Créer un fichier `.env` à la racine :

```env
POSTGRES_DB=pandorahearts
POSTGRES_USER=pandora
POSTGRES_PASSWORD=pandora

JWT_SECRET=change-me
PASSWORD_SALT=change-me-too

DROKEN_PASSWORD=motdepassefort
ADMIN_PASSWORD=autremotdepassefort
```

### 8.2 Lancer

```bash
docker compose up --build
```

Accès attendus :

- frontend : `http://localhost:3001`
- backend : `http://localhost:8000`
- health : `http://localhost:8000/health`

---

## 9. Import des données

L’import attend 2 fichiers :

- `gmbr`
- `gexp`

### 9.1 `gmbr`
Source des membres.  
Le parseur attend des entrées séparées par espaces, chaque entrée contenant 10 champs séparés par `|`.

Les champs réellement utilisés sont :

- `player_id`
- `account_id`
- `nickname`
- `level`
- `class_id`

### 9.2 `gexp`
Source des points GEXP.  
Le parseur attend des entrées séparées par espaces, avec :

- `player_id|points`

### 9.3 Comportement d’import
Pour une date donnée :

- les membres sont upsert,
- les anciennes lignes `WeeklyPoints` de cette date et de cette famille sont supprimées,
- les nouvelles lignes sont insérées.

---

## 10. Points techniques importants à connaître avant modification

### 10.1 Incohérence `role` entre migration SQL et code applicatif
Le code applicatif utilise :

- `Principale`
- `Secondaire`
- `Mule`

La migration `001_members_role_link.sql` utilise :

- `main`
- `secondary`
- `mule`

Avant d’ajouter de nouvelles migrations, il faut **choisir un seul vocabulaire** et le stabiliser partout.

---

### 10.2 Deux logiques “mensuel / 4 semaines”
Le backend et certaines pages frontend ne calculent pas exactement la même chose :

- backend : référence à ~28 jours avant la dernière date
- frontend : fenêtres fixes ancrées au `2026-01-25`

C’est acceptable si c’est volontaire, mais le README doit le dire explicitement pour éviter les confusions futures.

---

### 10.3 Proxy Nginx vs `API_BASE`
Le Nginx front prévoit un proxy `/api/`, mais le frontend consomme actuellement une URL absolue via `API_BASE`.  
Donc :

- le proxy existe,
- mais il n’est pas le chemin principal utilisé par le code.

---

### 10.4 Déploiement Argo CD à remettre d’équerre
Le manifest Argo CD actuel semble être un template non finalisé.  
Il faudra le corriger si tu veux un vrai déploiement GitOps depuis ce dépôt.

---

### 10.5 `run_migrations.py` à vérifier
Le backend l’exécute systématiquement au démarrage du conteneur.  
Vu son importance, il faut confirmer son contenu réel avant toute évolution de schéma.

---

## 11. Ce que je dois retenir pour travailler rapidement sur ce projet plus tard

Quand on me reparle de **PandoraHearts Family**, je dois comprendre immédiatement que :

- c’est un **dashboard Nostale** pour suivre une **famille**,
- la stack est **FastAPI + React + Postgres + Docker**,
- la donnée centrale est une série de **snapshots datés de GEXP**,
- chaque joueur peut être :
  - `Principale`
  - `Secondaire`
  - `Mule`
- un joueur peut aussi avoir un **statut** :
  - `actif`
  - `absent`
  - `arret_sans_nouvelle`
- il existe :
  - une page d’accueil classement,
  - une page historique,
  - une page joueur,
  - une page membres,
  - une page import admin,
  - une page dons admin,
- les admins peuvent :
  - importer des snapshots,
  - modifier pseudo / rôle / statut,
  - éditer des points,
  - supprimer un personnage,
  - gérer les dons,
- le frontend s’appuie sur l’API `https://api.pandorahearts-family.fr` par défaut,
- le dépôt contient encore quelques écarts d’infra ou de migration à clarifier.

---

## 12. Améliorations recommandées pour la suite

### Priorité haute
- compléter un vrai `.env.example`
- corriger l’incohérence FR/EN sur les rôles
- vérifier / sécuriser `run_migrations.py`
- réaligner `deploy/argocd/app.yaml` avec le vrai repo

### Priorité moyenne
- figer les versions Python dans `requirements.txt`
- supprimer le doublon `python-multipart`
- documenter précisément le format attendu des fichiers `gmbr` / `gexp`
- homogénéiser le calcul “mensuel” entre backend et frontend

### Priorité confort
- ajouter captures d’écran
- documenter les scénarios d’admin les plus fréquents
- ajouter une stratégie de backup / restore plus détaillée
- lister les endpoints dans une mini doc API plus formelle

---

## 13. Commandes utiles déjà présentes

### Restore DB
```bash
docker compose cp pandorahearts_backup_2026-02-24_1758.sql postgres:/tmp/pandorahearts_backup_2026-02-24_1758.sql
docker compose exec -T postgres sh -lc 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -f /tmp/pandorahearts_backup_2026-02-24_1758.sql'
```

### Backup DB
```bash
mkdir -p backups

docker compose exec -T postgres sh -lc \
'pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" --clean --if-exists --no-owner --no-privileges' \
> backups/pandorahearts_$(date +%F_%H-%M-%S).sql
```

### Restore depuis un fichier local
```bash
FILE="backups/TON_FICHIER.sql"

docker compose exec -T postgres sh -lc \
'psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"' \
< "$FILE"
```

---

## 14. Résumé ultra-court

**PandoraHearts Family** est un dashboard full-stack pour suivre les membres d’une famille Nostale à partir de snapshots GEXP, avec historique, fiches joueurs, gestion des rôles/statuts et outils d’administration.
- Le calculateur PvE importe les fiches personnage à mise en page fixe par OCR en respectant les catégories du simulateur source (équipement, points SP, fées, costumes, compagnons et passifs).
