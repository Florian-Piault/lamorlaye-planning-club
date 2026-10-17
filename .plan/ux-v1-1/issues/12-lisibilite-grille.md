# Lisibilité de la grille

Type: prototype
Status: resolved

## Question

Comment rendre la grille du planning lisible quand elle est dense ou la fenêtre étroite (960 px) ?

Constats : cartes tronquées (« Gala… 17h00–… »), dimanche caché à droite, défilement horizontal à 960 px. Pistes à montrer : nom complet au survol au minimum, vue « un jour à la fois », zoom, colonnes adaptatives, dimanche toujours atteignable. Contraintes de disposition dans `SPECS.md` §4.1 (variante A).

À traiter aussi (renvoyé par [Vocabulaire et bulles d'aide](09-vocabulaire-et-bulles.md)) : en-têtes de colonnes « C1, C2… » à remplacer par le vrai nom du court (abrégé si besoin) et sens du « ☀ » (extérieur) à rendre lisible.

## Answer

Prototype branché sur la page Planning, trois tours et neuf variantes, jugées à 960 px sur un club dense (5 courts, 4 moniteurs, ~70 cours sur 7 jours) (16/10/2026) : [archive](../prototypes/lisibilite-grille/README.md). **Variante G retenue : un jour à la fois, de la place rendue à la grille, une seule barre d'outils, la navigation des semaines avec celle des jours.**

Constat qui oriente tout : à 960 px, le menu de l'application (224 px) et le panneau latéral (320 px) prennent plus de la moitié de la largeur, et les bandeaux empilés (barre haute, en-tête sur deux lignes, bandeau de mode, trois lignes de filtres) plus de 300 px de hauteur. Même un seul jour à 5 courts tronque les noms tant que ces éléments restent dépliés.

- **Un jour à la fois** : bascule « Semaine / Jour » dans une barre des jours au-dessus de la grille ; une pastille par jour avec son nombre de cours (le dimanche est toujours atteignable), flèches jour précédent / suivant ; en vue Semaine, cliquer l'en-tête d'un jour l'affiche seul. La vue Semaine garde le défilement horizontal actuel (`SPECS.md` §4.1).
- **Navigation des semaines dans la barre des jours** : en « Une semaine précise », ‹ › Aujourd'hui et le sélecteur de date ouvrent la barre des jours, avant « Semaine / Jour », séparés par un filet ; l'en-tête ne garde que le choix « Planning habituel / Une semaine précise » (libellés de [Vocabulaire et bulles d'aide](09-vocabulaire-et-bulles.md)).
- **Panneau latéral repliable** : bouton icône en fin de barre des jours (« Replier / Afficher le panneau » au survol) ; replié, il disparaît entièrement, sans rail ; il se rouvre de lui-même quand on ouvre ou crée un cours.
- **Menu de l'application réductible aux icônes** (bouton « Réduire le menu » en bas, libellés au survol), pour toute l'application, choix mémorisé.
- **Une seule barre d'outils** sur le Planning :
  - barre haute (fil d'Ariane, saison) masquée sur cet écran, sélecteur de saison repris à droite de l'en-tête ; titre « Planning » visible des seuls lecteurs d'écran ;
  - Annuler, Rétablir et PDF en icônes avec le Tooltip commun ; « + Nouveau cours » garde son libellé ;
  - filtres (moniteurs, courts, groupe) dans un menu déroulant « Filtres » qui affiche le nombre de filtres actifs ;
  - pastilles des moniteurs réduites à la couleur et au prénom, toujours cliquables et glissables ; heures de la semaine au survol, total retiré de la barre (il reste dans « Heures »).
- **Bandeau de mode sur une seule ligne fine**, à hauteur fixe, phrase de portée gardée (tronquée si besoin) et info des hachures : compatible avec [Principe anti-décalage et règles des modales](06-stabilite-et-modales.md).
- **En-têtes de courts** : vrai nom du court, abrégé si la colonne est étroite (« Terre battue 1 » → « TB1 », « Central » → « Cent. »), icône soleil (extérieur) ou maison (couvert), nom complet et nature au survol ; légende « couvert · extérieur » dans la barre des jours. Remplace « C1, C2… » et le « ☀ » seul.
- **Fiche du cours au survol** à la place du `title` natif : nom complet du groupe, jour et horaire, court, moniteur, effectif, avertissements, liseré à la couleur du moniteur ; apparaît après un court délai, disparaît au clic ou au défilement. Les cartes gardent leurs trois lignes ; le nom passe sur deux lignes si la carte est assez haute.
- **Reste à régler dans la spec** : à 960 px, l'en-tête tient encore sur deux lignes (pastilles et saison passent à la ligne) ; `SPECS.md` §4.1 (en-têtes « C1, C2 », défilement seul) est à aligner.
- **Non retenu** : tout faire tenir en largeur (A : simples barres de couleur à 960 px), la loupe et la bande « aller au jour » (C), filtres repliés en ligne (D), plein écran à la demande (F), navigation des semaines dans le bandeau (H, phrase de portée tronquée) ou dans le choix du mode (I).
