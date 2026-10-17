# Corrections UX v1.1 (retours personas)

## Destination

Une spec (`spec.md`, via `/to-spec`) du lot UX v1.1 qui traite les 7 priorités, le chantier vocabulaire et les bugs B1–B12 du [test d'utilisabilité à deux personas](https://claude.ai/artifact/FpvQwdukveg58QyMz4QVH1) (Alex expert, Monique débutante), prête à être découpée en lots L9… dans un `LOTS-V1.1.md`.

## Notes

- Domaine : Kairos, application Tauri + React de planning de cours collectifs de tennis, une seule utilisatrice type bénévole peu technicienne. Règles métier dans [`SPECS.md`](../../SPECS.md), lots V1 dans [`LOTS-V1.md`](../../LOTS-V1.md), prise en main dans [`docs/DEMARRAGE-RAPIDE.md`](../../docs/DEMARRAGE-RAPIDE.md).
- La spec est un document à part ; `SPECS.md` n'est amendé que là où une règle métier change (doublons, alertes d'âge).
- Chaque chantier est jugé avec les deux profils en tête : rien de ce qui aide Monique ne doit ralentir Alex, et inversement.
- Les finitions isolées du rapport sont rattachées au chantier où elles tombent ; sinon hors périmètre.
- Tickets de type prototype : skill `prototype`. Discussions : skill `brainstorm`.

## Decisions so far

<!-- the index: one line per resolved ticket, enough to judge relevance, then open the link for the detail the ticket holds -->

- [État de la saisie des élèves et de l'import](issues/03-saisie-eleves-et-import.md): téléphone obligatoire sans condition, niveau non déduit, pas de « créer et continuer » ; l'import gère déjà doublons (nom+prénom+naissance) et groupes, et son cœur accepte un TSV collé sans refonte.
- [Inventaire des libellés techniques et des icônes sans aide](issues/04-inventaire-jargon.md): ~45 libellés et ~13 boutons icône relevés avec pistes ; aucun composant Tooltip (seulement `title` natif), prop `hint` de `Field` inutilisée, glossaire `SPECS.md` §2 incomplet et invisible dans l'app.
- [Inventaire des décalages de mise en page et du comportement des modales](issues/01-inventaire-decalages-et-modales.md): aucun message conditionnel ne réserve sa place ; `dialog.tsx` (wrapper `<dialog>` natif) couvre les 15 modales et explique B3 (autoFocus avant `showModal`) et Échap ; `Field`/`ErrorAlert` couvrent les erreurs ; ni composant d'avertissement ni raison de bouton grisé.
- [Causes des bugs mécaniques](issues/02-causes-bugs-mecaniques.md): B4, B6, B8, B10, B12 ont une correction évidente (B4 = mode d'emploi pas à jour, « N » seul retiré exprès) ; clic simple de la frise, moniteur occupé et pont de l'Ascension demandent un arbitrage ; forme de la confirmation B11 tranchée par le ticket anti-décalage (toast commun).
- [Vérifier l'aperçu PDF dans l'application de bureau](issues/05-verifier-apercu-pdf.md): les 3 aperçus sont lisibles sous Tauri ; B13 venait du navigateur de test.
- [Principe anti-décalage et règles des modales](issues/06-stabilite-et-modales.md): avertissements et `ErrorAlert` dans une zone réservée commune de 2 lignes (repliable au-delà), succès et erreurs du planning en toast commun, barre de mode à hauteur fixe, éléments conditionnels toujours présents ; modales et panneau de cours : focus sur le premier champ, Échap en cascade, confirmation seulement si saisie modifiée, raison visible des boutons grisés.
- [Doublons et alerte d'âge](issues/07-doublons-et-alerte-age.md): jamais bloquant ; doublon élève = nom+prénom (+ naissance si connue) sur toutes saisons, « Ouvrir sa fiche » ou « Reprendre ses coordonnées » si saison passée ; initiales prises → proposition en un clic ; court homonyme averti ; tranche affichée et marquée dans la liste des groupes, alertée au cochage et dans l'aperçu d'import ; amende `SPECS.md` §7 et §8.
- [Guidage de la première utilisation](issues/08-guidage-premiere-utilisation.md): guidage fondu dans la navigation (prototype, variante C) : pastilles d'étape sur les onglets des Référentiels, accueil « Avant de construire le planning » à la place des états vides, toast à chaque étape franchie ; rien à masquer, tout s'efface une fois les données saisies.
- [Vocabulaire et bulles d'aide](issues/09-vocabulaire-et-bulles.md): « Planning habituel » / « Une semaine précise » avec phrase de portée dans la barre de mode, « exception » et « occurrence » remplacés par des phrases, « cours ponctuel » gardé, « Le club », « En cours / Terminée », « horaire de disponibilité » ; Tooltip commun sur toute icône, libellé visible si rare ; infos techniques repliées dans « Détails techniques » ; `SPECS.md` §2 gagne une colonne « Libellé affiché ».
- [Mode d'emploi du planning](issues/10-mode-emploi-planning.md): astuce selon le contexte en tête du panneau (prototype, variante C), « + Nouveau cours » d'abord, bouton bien visible « Tout le mode d'emploi » qui déplie « Les bases » puis « Pour aller plus vite » ; seul Ctrl/⌘ N annoncé, touches selon le système.
- [Saisie des élèves en volume](issues/11-saisie-eleves-volume.md): « Enregistrer et ajouter un autre » (groupes et niveau gardés), collage tableur dans l'import (en-têtes détectés), liens d'import depuis Élèves et fiche groupe, champ d'ajout de la fiche groupe vidé avec Entrée et « Créer cet élève », plus de fiche forcée après création d'un groupe ; téléphone élève ou responsable (migration), niveau proposé depuis le groupe, Prénom puis Nom.
- [Lisibilité de la grille](issues/12-lisibilite-grille.md): un jour à la fois (« Semaine / Jour », barre des jours avec la navigation des semaines), panneau latéral repliable sans rail, menu de l'app réductible aux icônes, Planning en une seule barre (filtres en menu, icônes, pastilles réduites, saison dans l'en-tête, bandeau de mode fin) ; vrais noms de courts abrégés avec icône soleil / maison, fiche du cours au survol ; `SPECS.md` §4.1 à aligner.
- [Arbitrages métier des bugs](issues/13-arbitrages-bugs-metier.md): clic simple de la frise = pré-remplit « Jour / De / À » (plage entière + « Retirer » sur une case disponible), toast « Annuler » après chaque geste ; « Nouveau cours » en trois groupes Disponibles / Occupés sur ce créneau (avec le cours) / Indisponibles, hachures inchangées ; ponts = vacances, férié décoché seulement si une période cochée le couvre, badge nommé ; `SPECS.md` §3.3, §3.8, §5.1 amendés.

## Not yet specified

Rien : la destination est atteinte. Tests et documentation sont traités dans [la spec](spec.md), le découpage dans [`LOTS-V1.1.md`](../../LOTS-V1.1.md).

## Out of scope

- Frictions secondaires hors des chantiers : réglages métier (durée par défaut d'un cours, pas de la grille, zone scolaire), déplacement d'un cours aux flèches, poignée de redimensionnement, Ctrl+N qui reprend le contexte, Alt+glisser et import non testés jusqu'au bout. Raison : le périmètre est fixé aux 7 priorités, au vocabulaire et aux bugs.
- B13, aperçu PDF noir : ne se reproduit pas dans l'application de bureau ([Vérifier l'aperçu PDF dans l'application de bureau](issues/05-verifier-apercu-pdf.md)). Raison : ce n'est pas un défaut de Kairos.
