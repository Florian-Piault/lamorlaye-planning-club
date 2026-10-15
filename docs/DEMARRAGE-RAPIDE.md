# Guide de démarrage rapide — Planning Club

Ce guide accompagne la première prise en main : de la création de la saison jusqu'à la diffusion du planning. Comptez une à deux heures pour saisir un club complet. Chaque modification est **enregistrée immédiatement** : il n'y a pas de bouton « Enregistrer » à chercher, et l'application peut être fermée à tout moment.

La barre latérale donne accès aux écrans : **Planning**, **Heures**, **Référentiels**, **Import/Export**, **Réglages** et **À propos**.

## 1. Créer la saison

**Référentiels › Saison**

1. Saisissez le **nom** (ex. « 2026-2027 »), les **dates de début et de fin** (ex. 01/09/2026 → 30/06/2027).
2. Réglez l'**amplitude horaire** affichée dans le planning (8h00 – 22h00 par défaut) et les **jours affichés** (décochez le dimanche si le club ne donne pas cours ce jour-là).
3. Cliquez sur **Créer la saison**.

Une seule saison est active à la fois. Les saisons passées restent consultables en lecture seule (sélecteur *Saison consultée* en haut de la barre latérale).

## 2. Saisir les référentiels

Suivez les onglets de **Référentiels** dans l'ordre :

1. **Courts** : nom, couvert ou extérieur. L'ordre d'affichage dans le planning se règle en faisant glisser les courts dans la liste.
2. **Moniteurs** : nom, prénom, coordonnées. Une **couleur** libre de la palette est attribuée automatiquement (modifiable), ainsi que les **initiales** affichées sur chaque cours.
   - Dans la fiche du moniteur, saisissez ses **disponibilités hebdomadaires** (plusieurs plages par jour possibles) : elles servent aux avertissements et aux hachures du planning.
   - Ajoutez ses **indisponibilités ponctuelles** (congé, tournoi…) au fil de la saison.
3. **Niveaux** : la liste est pré-remplie (niveaux Galaxie et adultes) ; ajoutez, renommez ou réordonnez si besoin.
4. **Groupes** : nom, niveau, tranche d'âge (facultative) et effectif maximum. Ouvrez un groupe pour composer sa liste d'élèves : recherchez un élève puis **Ajouter**, ou faites glisser sa poignée sur la composition. Les alertes (effectif dépassé, âge hors tranche) s'affichent aussitôt.
5. **Élèves** : nom, prénom, téléphone, date de naissance, niveau, classement FFT, responsable légal pour les mineurs, groupes.
   - Pour éviter la saisie à la main : **Import/Export › Importer des élèves** accepte un fichier CSV ou Excel (export de l'outil d'adhésion). L'assistant fait correspondre les colonnes, signale les lignes en erreur et détecte les doublons ; l'import entier peut être annulé.
6. **Fermetures** : vacances scolaires et jours fériés. Le bouton d'**assistant** propose les vacances de la **zone B** et les jours fériés de la saison ; cochez celles à retenir (les dates restent modifiables).

Un élément utilisé (un moniteur qui a des cours, par exemple) ne se supprime pas par erreur : l'application propose de l'**archiver**.

## 3. Construire la semaine type

**Planning**, mode **Semaine type** (bandeau bleu) : les cours créés ici se répètent toutes les semaines de la saison.

- **Créer un cours** : cliquez-glissez verticalement dans la colonne d'un court, à l'heure voulue ; le panneau de droite s'ouvre pré-rempli (jour, heure, durée, court). Choisissez le groupe (ou créez-le à la volée) et le moniteur : les moniteurs **disponibles** sur le créneau sont proposés en premier. Le bouton **Nouveau cours** (ou **Ctrl/Cmd + N**) ouvre le même panneau vide.
- **Déplacer** un cours : faites-le glisser (pas de 15 min, vers un autre jour ou un autre court). **Alt / Option** pendant le glisser : le cours est **dupliqué**. **Échap** interrompt le geste.
- **Changer la durée** : tirez le bord inférieur du cours.
- **Changer de moniteur** : faites glisser la pastille d'un moniteur (légende en haut à droite) sur le cours, ou passez par le panneau.
- **Au clavier** : Tab jusqu'à un cours, **Entrée** ouvre son détail ; **Espace** le saisit, les **flèches** le déplacent (↑ ↓ : 15 min, ← → : court suivant ; avec **Maj** : 1 heure ou un jour), **Espace** ou **Entrée** le déposent, **Échap** annule.
- **Supprimer** : sélectionnez le cours puis **Suppr**, ou bouton *Supprimer* du panneau.
- **Annuler / rétablir** sans limite : **Ctrl/Cmd + Z** et **Ctrl/Cmd + Maj + Z** (ou les boutons *Annuler* / *Rétablir*).

Rien n'est bloqué : un conflit (court déjà occupé, moniteur déjà pris ou indisponible, élève inscrit à deux cours simultanés, effectif ou âge hors limites) est **signalé** par une bordure rouge et ⚠ sur le cours. Le panneau **Avertissements** les liste tous ; un clic mène au cours concerné. Survolez un cours (ou cliquez sur la pastille d'un moniteur) pour **hachurer** les créneaux où son moniteur est indisponible. Les **filtres** estompent les cours d'autres moniteurs, courts ou groupes ; la légende affiche le total d'heures de chaque moniteur.

## 4. Gérer les semaines datées

Cliquez sur **Semaine du JJ/MM** (bandeau vert) pour voir une semaine réelle : la semaine type, moins les fermetures, avec les exceptions. Naviguez avec les boutons, les touches **← / →**, **Aujourd'hui** ou le sélecteur de date.

Dans ce mode, une modification ne concerne **que cette semaine** (exception) ; la semaine type et les autres semaines ne changent pas. Cliquez sur un cours pour :

- le **modifier pour cette semaine** (ou le faire glisser directement) ;
- **annuler cette séance** (motif : pluie, moniteur absent, autre) — elle apparaît grisée et barrée ;
- **désigner un remplaçant** — la séance prend sa couleur et l'indicateur ⇄ ;
- **rétablir l'occurrence d'origine** (supprime l'exception) ;
- **Appliquer à partir de cette semaine** : pour un changement durable en cours de saison (nouvel horaire à partir de janvier, par exemple) ; les semaines précédentes restent inchangées.

**Nouveau cours** en semaine datée crée un **cours ponctuel** (rattrapage, séance d'essai, stage), y compris pendant une fermeture : la bande « Fermé » reste visible en fond. **Dupliquer sur les jours suivants** recopie un cours ponctuel sur plusieurs jours (stage du lundi au vendredi).

## 5. Diffuser le planning

- **PDF de la semaine affichée** : bouton **PDF** ou **Ctrl/Cmd + P** dans le planning ; format A4 ou A3 paysage, aperçu puis enregistrement, et ouverture dans le lecteur PDF pour imprimer. Les initiales des moniteurs restent lisibles en noir et blanc.
- **Import/Export › Documents PDF** : planning **par moniteur** (un fichier ou tous en lot) et **feuilles d'appel** par groupe (élèves, téléphones, responsables légaux, colonnes de présence).
- **Import/Export › Exports CSV / Excel** : cours, groupes, élèves.
- **Heures** : récapitulatif des heures de chaque moniteur sur une période (raccourcis *mois en cours* et *saison*), détail des séances et export CSV. Les fermetures et annulations ne comptent pas, le remplaçant est crédité, les cours ponctuels sont inclus.

## 6. Sauvegarder

**Réglages › Sauvegardes**

- Une **copie automatique** est faite à chaque fermeture de l'application (les 30 dernières sont conservées).
- **Exporter une sauvegarde…** : copie complète dans un fichier unique, à placer sur une clé USB ou un autre support. Cochez le **chiffrement par mot de passe** (recommandé : le fichier contient les données personnelles des élèves) et conservez ce mot de passe en lieu sûr.
- **Restaurer une sauvegarde…** : remplace les données actuelles par celles du fichier choisi, après une copie de l'état courant.

Prenez l'habitude d'exporter une sauvegarde chaque semaine, et avant toute mise à jour de l'application.

## 7. Préparer la saison suivante

**Référentiels › Saison › Nouvelle saison** : choisissez **Dupliquer la saison** pour reprendre les courts, les moniteurs et leurs disponibilités, les groupes et leurs élèves, ainsi que la semaine type. Les exceptions, indisponibilités ponctuelles et fermetures ne sont pas reprises : relancez l'assistant des fermetures pour la nouvelle saison. L'ancienne saison est archivée, consultable en lecture seule.

## 8. Données personnelles (RGPD)

Depuis la liste des élèves (bouton *Données personnelles*) ou **Réglages › Données personnelles** : **export** des données d'un élève (toutes saisons) et **suppression définitive**, y compris de ses groupes et des saisons archivées.

## Raccourcis clavier

| Raccourci | Action |
|---|---|
| Ctrl/Cmd + N | Nouveau cours (cours ponctuel en semaine datée) |
| Suppr | Supprimer le cours sélectionné |
| Ctrl/Cmd + Z | Annuler |
| Ctrl/Cmd + Maj + Z (ou Ctrl + Y) | Rétablir |
| ← / → | Semaine précédente / suivante (semaine datée) |
| Ctrl/Cmd + P | PDF de la semaine affichée |
| Entrée (sur un cours) | Ouvrir le détail du cours |
| Espace, flèches, Espace (sur un cours) | Déplacer le cours au clavier |
| Échap | Interrompre un glisser, fermer le panneau |
