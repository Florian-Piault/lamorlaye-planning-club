# Mode d'emploi du planning

Type: prototype
Status: resolved
Blocked by: 08, 09

## Question

Que dit le mode d'emploi du planning, dans quel ordre, et comment se replie-t-il ?

Il commence aujourd'hui par les gestes experts (glisser, Alt, Suppr, ⌘Z) et n'est pas repliable. À montrer : un texte qui part de « + Nouveau cours », une section « Pour aller plus vite » avec gestes et raccourcis, l'état replié par défaut (ou mémorisé), et son articulation avec le guidage de première utilisation. Le raccourci « N » annoncé doit marcher ou disparaître (cause dans [Causes des bugs mécaniques](02-causes-bugs-mecaniques.md)).

Vocabulaire à employer : celui de [Vocabulaire et bulles d'aide](09-vocabulaire-et-bulles.md) (« Planning habituel », « Une semaine précise », raccourcis selon le système, « Échap annule le déplacement »).

## Answer

Prototype à trois variantes branché sur la page Planning (16/10/2026) : [archive](../prototypes/mode-emploi-planning/README.md). **Variante C retenue : une astuce selon le contexte, le texte complet sur demande.**

- **Astuce** en tête du panneau latéral (au-dessus des Avertissements), une phrase qui change selon l'état :
  - aucun cours placé : « Commencez par **+ Nouveau cours** en haut : jour, heure, court, groupe et moniteur, puis Enregistrer » ;
  - un cours sélectionné : glisser pour déplacer, tirer le bas pour la durée, Suppr (⌫ sur Mac) le supprime, Ctrl/⌘ Z annule ;
  - sinon : « Cliquez un cours pour le modifier », avec la phrase de portée « Planning habituel » / « Une semaine précise ».
- **Bouton « Tout le mode d'emploi »** sous l'astuce, qui doit se voir cliquable : icône livre, chevron qui pivote, bordure ; devient « Masquer le mode d'emploi ». Replié par défaut à chaque ouverture du planning, rien à mémoriser.
- **Texte complet**, dans cet ordre :
  1. **Les bases**, numérotées : « + Nouveau cours » ; cliquer un cours pour le modifier ou le supprimer ; Planning habituel (toutes les semaines) contre Une semaine précise (une seule fois : vacances, tournoi) ; le bouton Annuler revient en arrière.
  2. **Pour aller plus vite** : glisser dans la colonne d'un court (créer), glisser un cours (déplacer, par 15 min), tirer le bas (durée), Alt/⌥ Option + glisser (dupliquer), glisser la pastille d'un moniteur sur un cours, survol (rayures d'indisponibilité), Ctrl/⌘ N, Suppr/⌫, Ctrl/⌘ Z et Ctrl/⌘ ⇧ Z, « Échap annule le déplacement en cours », ← → en semaine précise.
- **Raccourci « N »** : seul Ctrl/⌘ N est annoncé (cause B4 dans [Causes des bugs mécaniques](02-causes-bugs-mecaniques.md)) ; touches affichées selon le système.
- **Articulation avec le guidage** ([Guidage de la première utilisation](08-guidage-premiere-utilisation.md)) : tant qu'une étape avant le planning manque, l'accueil « Avant de construire le planning » occupe la page ; une fois courts, moniteurs et groupes saisis, l'astuce « aucun cours placé » prend le relais jusqu'au premier cours, qui clôt le guidage.
- **Non retenu** : la section repliable mémorisée (A) et le bouton « Aide » avec feuille flottante (B).
