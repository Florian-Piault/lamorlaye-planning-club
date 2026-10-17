# Arbitrages métier des bugs

Type: grilling
Status: resolved
Blocked by: 02

## Question

Trois bugs cachent une règle métier floue (détail dans [Causes des bugs mécaniques](02-causes-bugs-mecaniques.md)) ; quelle règle retient-on pour chacun ?

- **Clic simple dans la frise des disponibilités** : ne rien faire, basculer 15 min, basculer une heure, ou pré-remplir le formulaire « Jour / De / À » ? Une annulation dans l'éditeur ?
- **Moniteur déjà occupé** dans « Nouveau cours » : reste-t-il « disponible », passe-t-il dans un groupe « Occupés sur ce créneau » (avec le cours), ou parmi les indisponibles ? Hachures pour ses cours affectés ? (SPECS §5.1, §4.4, §7)
- **Pont de l'Ascension** dans l'assistant des fermetures : compte-t-il comme des vacances pour le classement et le décochage par défaut des jours fériés ?

Amende `SPECS.md` là où la règle change.

## Answer

Discussion du 16/10/2026. `SPECS.md` amendé en §3.3, §3.8 et §5.1 ; §4.4 inchangé.

**Clic simple dans la frise des disponibilités**

- Un clic simple (sans glisser au-delà d'un seuil de quelques pixels) n'enregistre rien : il pré-remplit le formulaire « Jour / De / À » sous la frise et y place le focus.
- Case vide : l'heure cliquée plus une heure, bouton « Ajouter ».
- Case déjà disponible : les bornes de la plage entière, boutons « Ajouter » et « Retirer » ; ajuster De / À permet de retirer une partie. Le formulaire gagne donc « Retirer ».
- Le cliquer-glisser garde son rôle (tracer ou effacer), avec la correction de B6.
- Annulation : chaque geste enregistré est annoncé par le toast commun ([Principe anti-décalage et règles des modales](06-stabilite-et-modales.md)), par ex. « Lundi 14:00–18:00 ajouté », avec « Annuler » qui rétablit les plages précédentes. Pas d'historique complet ni de Ctrl/⌘ Z.

**Moniteur déjà occupé dans « Nouveau cours »**

- Trois groupes, dans cet ordre : Disponibles ; « Occupés sur ce créneau », avec le cours sur la ligne (« Galaxie vert 17:00–18:00 ») ; Indisponibles.
- Le cours en cours d'édition est exclu du calcul.
- Occupé et hors disponibilités : rangé parmi les Indisponibles, la ligne mentionne aussi le cours. Chaque moniteur n'apparaît qu'une fois.
- Tous restent sélectionnables ; le conflit est signalé par l'avertissement du §7.
- Hachures : uniquement les créneaux hors disponibilités (§4.4), pas les cours déjà affectés (visibles par leur couleur).

**Pont de l'Ascension dans l'assistant des fermetures**

- Les ponts comptent comme des vacances : proposés et cochés comme une période.
- Un jour férié n'est décoché par défaut que si une période cochée le couvre ; il se recoche si on décoche cette période (calcul suivi, plus figé à l'ouverture).
- Le badge nomme la période : « compris dans Pont de l'Ascension ».
