# Ego Party - Slot Machine App

## Original Problem Statement
Application de type machine à sous de casino à un seul emplacement. L'action sur un levier doit faire défiler des photos et en sélectionner une au hasard pour l'afficher.

## User Personas
- Organisateurs de fêtes/soirées qui veulent un moyen ludique de sélectionner des personnes au hasard
- Utilisateurs souhaitant une expérience de "tirage au sort" visuellement attrayante

## Core Requirements
- **Style:** Rétro casino avec palette bleu sarcelle foncé, cyan et bronze/doré
- **Affichage photo:** Cadre polaroïd, ratio 1:1.21
- **Animation:** Défilement vertical, rapide au début puis décélération progressive
- **Sélection:** Photo finale choisie de manière purement aléatoire
- **Sons:**
  - Sons machine à sous (levier, arrêt, clics)
  - Volume à 15% du maximum
- **Levier:**
  - Horizontal en bas pour desktop ET mobile (swipe gauche->droite)
- **Effets visuels:**
  - Lumières clignotantes pendant le spin
  - Titre "EGO PARTY" clignote après affichage photo finale

## What's Been Implemented

### Completed Features
- [x] Machine à sous avec style rétro casino
- [x] Palette de couleurs: bleu sarcelle foncé, cyan, bronze/doré
- [x] Upload de photos via localStorage (frontend only)
- [x] 166 photos déjà migrées en built-in (`/app/frontend/src/assets/photos/`)
- [x] Animation de défilement vertical avec décélération
- [x] Sélection aléatoire de la photo finale
- [x] Levier interactif horizontal en bas (desktop + mobile)
- [x] Effets sonores (levier, clics, arrêt) à 15% volume
- [x] Lumières casino clignotantes (ampoules)
- [x] Clignotement du titre "EGO PARTY" à la fin
- [x] Design responsive (desktop et mobile)
- [x] Page de gestion des photos (/manage)
- [x] Cadre noir entre photo et cadre doré supprimé (Feb 2026)
- [x] **Bug cinétique du dernier clic corrigé** (Feb 2026)

### Bug Fix - Kinetic Sync (Feb 2026)
**Problème:** Le dernier clic sonore se déclenchait 343ms après que la photo finale soit arrivée au centre — l'utilisateur entendait un clic sans changement visuel.

**Cause:** Dans `SlotReel.jsx`, le timing des clics utilisait `y = i / (STRIP_LEN-1)`, ce qui ne tenait pas compte de l'overshoot de 14px. De plus, l'easing keyframe `cubic-bezier(0.33, 0.68, 0.49, 0.98)` ne correspondait pas exactement à la formule inverse ease-out cubic utilisée.

**Fix:**
1. Easing keyframe passé à `cubic-bezier(0.215, 0.61, 0.355, 1)` (ease-out cubic canonique).
2. Formule de timing : `y = (i * SLOT_HEIGHT) / |peakY|` au lieu de `y = i / (STRIP_LEN-1)`. Cela aligne chaque clic sur le moment réel où la photo atteint le centre de la viewport.

Dernier clic décalé de 2300ms → 1958ms.

## Technical Architecture
```
/app
├── backend/          # FastAPI (peu utilisé actuellement)
│   ├── server.py
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── assets/photos/        # 166 photos built-in
    │   ├── components/
    │   │   ├── CasinoBulbs.jsx    # Ampoules décoratives
    │   │   └── SlotReel.jsx       # Animation du défilement
    │   ├── pages/
    │   │   ├── PhotoManager.jsx   # Upload/gestion photos
    │   │   └── SlotMachine.jsx    # Page principale
    │   ├── index.css              # Variables CSS, animations
    │   └── App.js                 # Routing
    └── package.json
```

## Data Storage
- **Photos built-in:** 166 photos statiques dans `/app/frontend/src/assets/photos/`
- **Photos utilisateur (legacy):** localStorage clé `slotPhotos`

## Prioritized Backlog

### P0 (Critique)
- Aucune tâche en attente

### P1 (Important)
- Aucune tâche en attente

### P2 (Nice-to-have)
- Connecter le backend pour un stockage persistant
- Permettre le partage de sessions entre appareils

## 3rd Party Integrations
- Google Fonts: Bebas Neue, Inter
- Mixkit CDN: Fichiers audio

## Critical Info
- **Langue :** Répondre à l'utilisateur en **français**.
- **PWA Cache :** Le service worker cache l'app. Pour voir les changements en preview, utiliser la navigation privée ou hard refresh.
