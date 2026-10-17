# Prototype : guidage de la première utilisation

Ticket : [Guidage de la première utilisation](../../issues/08-guidage-premiere-utilisation.md).

## Question

À quoi ressemble le guidage d'une première utilisation (liste d'étapes Saison · Courts · Moniteurs · Groupes · Élèves · Planning, états vides, confirmations), et où vit-il, en restant discret pour un expert ?

## Variantes

- **A. Carte dans la barre latérale** : carte « Bien démarrer » (progression, étape suivante en avant), masquable, rouvrable par « Guide de démarrage » dans la section Application.
- **B. Bandeau d'étapes** : ligne fixe sous la barre haute, étapes cochées + bouton de l'étape suivante, masquable, rouvrable par « Démarrage n/6 » près du sélecteur de saison.
- **C. Fondu dans la navigation** : onglets des Référentiels numérotés (coche si fait, étape suivante en couleur) et accueil du planning « Avant de construire le planning » à la place de l'état vide.

Commun aux trois : toast « Saison créée · Étape suivante : ajouter vos courts » (forme du ticket anti-décalage).

## Verdict

**Variante C** retenue (16/10/2026). Détail dans la réponse du ticket.

## Relancer

```bash
git apply .plan/ux-v1-1/prototypes/guidage-premiere-utilisation/montage.patch
mkdir -p src/features/onboarding-prototype
cp .plan/ux-v1-1/prototypes/guidage-premiere-utilisation/OnboardingPrototype.tsx src/features/onboarding-prototype/
pnpm dev
```

Ouvrir http://localhost:1420/?variant=C#/planning (barre rose en bas ou Alt+←/→ pour changer de variante). En navigateur la base est en mémoire : recharger = première utilisation.
