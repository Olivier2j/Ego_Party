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
  - Desktop: Vertical à droite de la machine
  - Mobile: Horizontal sous la machine (swipe gauche->droite)
- **Effets visuels:**
  - Lumières clignotantes pendant le spin
  - Titre "EGO PARTY" clignote après affichage photo finale

## What's Been Implemented

### Completed Features (22 Feb 2025)
- [x] Machine à sous avec style rétro casino
- [x] Palette de couleurs: bleu sarcelle foncé, cyan, bronze/doré
- [x] Upload de photos via localStorage (frontend only)
- [x] Animation de défilement vertical avec décélération
- [x] Sélection aléatoire de la photo finale
- [x] Levier interactif (vertical desktop, swipe horizontal mobile)
- [x] Effets sonores (levier, clics, arrêt) à 15% volume
- [x] Lumières casino clignotantes (ampoules)
- [x] Clignotement du titre "EGO PARTY" à la fin
- [x] Design responsive (desktop et mobile)
- [x] Page de gestion des photos (/manage)

## Technical Architecture
```
/app
├── backend/          # Non utilisé actuellement
│   ├── server.py
│   └── requirements.txt
└── frontend/
    ├── src/
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
- **Stockage:** localStorage uniquement (SIMULÉ - pas de backend)
- **Clé:** `slotPhotos`
- **Format:** Array d'objets `{id, src (base64), name, addedAt}`

## Known Limitations
- Backend non connecté - toutes les données sont en localStorage
- Capacité recommandée: ~250 photos

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
