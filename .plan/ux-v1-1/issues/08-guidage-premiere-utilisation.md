# Guidage de la première utilisation

Type: prototype
Status: resolved

## Question

À quoi ressemble le guidage d'une première utilisation, et où vit-il ?

À montrer : une liste d'étapes « Saison ✓ · Courts · Moniteurs · Groupes · Élèves · Planning » (où l'afficher, quand la cacher, peut-on la rouvrir), les états vides (« Créez d'abord vos courts » sur un planning sans court, etc.), et les confirmations manquantes qui rassurent (« Saison créée », « Enregistré » après une plage), lesquelles afficher (voir [Causes des bugs mécaniques](02-causes-bugs-mecaniques.md), B11). Leur forme est tranchée : toast commun ([Principe anti-décalage et règles des modales](06-stabilite-et-modales.md)). Doit rester discret pour un expert.

## Answer

Prototype à trois variantes branché sur l'application (16/10/2026) : [archive](../prototypes/guidage-premiere-utilisation/README.md). **Variante C retenue : le guidage est fondu dans la navigation existante**, sans panneau ni bandeau dédié.

- **Onglets des Référentiels** : les étapes Saison, Courts, Moniteurs, Groupes, Élèves portent une pastille (numéro d'ordre, coche une fois faite, étape suivante en couleur). Niveaux et Fermetures, facultatifs, n'en ont pas. Étape faite = au moins un enregistrement dans la saison. Les pastilles disparaissent quand toutes les étapes sont faites, y compris le premier cours placé.
- **Accueil du planning** : tant qu'il manque une étape avant le planning, les états vides « Aucune saison » et « Aucun court » sont remplacés par « Avant de construire le planning » : une phrase qui explique le lien cours / court / moniteur / groupe, les étapes dans l'ordre avec leur coche, un bouton pour l'étape suivante seulement, et la mention « Niveaux et fermetures sont facultatifs et peuvent attendre ».
- **Pas de masquage ni de réouverture** : rien à fermer, le guidage s'efface de lui-même quand les données existent ; un expert qui saisit vite ne voit que des pastilles discrètes.
- **Confirmations** : toast commun du [Principe anti-décalage et règles des modales](06-stabilite-et-modales.md), à chaque première fois qu'une étape est franchie (« Saison créée », « Premier court ajouté »…), avec « Étape suivante : … » en lien. Les autres confirmations manquantes (B11 saison, « Enregistré » après une plage de disponibilité) passent par le même toast, sans la ligne d'étape.
- **Hors de C, non retenu** : la carte de barre latérale (A) et le bandeau d'étapes (B) avec leur masquage.
