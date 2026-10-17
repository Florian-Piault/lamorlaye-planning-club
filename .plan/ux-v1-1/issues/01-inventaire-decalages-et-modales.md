# Inventaire des décalages de mise en page et du comportement des modales

Type: research
Status: resolved

## Question

Où, dans le code, des éléments apparaissent ou disparaissent en décalant ce qui est sous le curseur, et comment se comportent aujourd'hui les modales ?

Cas connus du rapport : phrase « Élève mineur… » dans le formulaire élève, bandeau de hachures du panneau de cours (B7, ~17 px), barre des compteurs, toute autre apparition conditionnelle dans les formulaires et panneaux. Côté modales : focus initial (B3, focus sur la croix), Échap qui ferme tout et efface la saisie (y compris depuis un calendrier ouvert), absence de confirmation à la fermeture d'une saisie remplie, bouton grisé sans explication (« Ajouter la plage »).

Une réponse complète donne, pour chaque cas : fichier:ligne, composant, mécanisme actuel, et s'il existe un composant partagé (Dialog shadcn, wrapper maison) par lequel une correction unique passerait. Elle sert à trancher [Principe anti-décalage et règles des modales](06-stabilite-et-modales.md).

## Answer

Recherche dans le code (lecture seule), 16/10/2026. Lignes vérifiées dans le code, pas à l'écran.

### Décalages

Aucun élément conditionnel ne réserve sa place : tous sont rendus par `{cond && …}` dans le flux, sans `min-height`, `visibility` ni superposition.

| Cas | fichier:ligne | Mécanisme |
|---|---|---|
| « Élève mineur : renseignez… » | `src/features/referentiels/eleves/StudentForm.tsx:142-146` | `{minor && <p>}` selon la date de naissance ; responsable, groupes et boutons descendent. |
| Bandeau des hachures (B7) | `src/features/planning/PlanningPage.tsx:1249-1254` (`ModeBar`, l.1108, `flex-wrap`) | Texte présent seulement si un moniteur est hachuré (`interaction.ts:105-111`) ; la barre passe sur 2 lignes. `ModeBar` est au-dessus de l'`<aside>` (l.1154) : tout le panneau, donc « Créer le cours », bouge. ~16 px + 4 px de gap, cohérent avec les ~17 px. |
| Même barre | `PlanningPage.tsx:1244-1248` | `{hiddenVersions > 0 && …}`, même effet. |
| Barre des compteurs | `src/features/referentiels/groupes/GroupPage.tsx:238-250` | `{alerts.messages.length > 0 && <ul>}` (badges `src/domain/groups.ts:64-66`) à l'ajout/retrait d'un membre ; décale le tableau et la zone de dépôt. Hypothèse la plus probable. |
| Avertissements du créneau | `src/features/planning/components/LessonPanel.tsx:355-366` | Recalculés à chaque changement (l.163), au-dessus des boutons (l.369) : autre suspect du saut de « Créer le cours ». |
| Erreurs et aides de champ | `src/components/form/Field.tsx:38-48` (`Field`), `:54-63` (`ErrorAlert`) | Ligne d'erreur ajoutée sous le champ ; `ErrorAlert` (bloc `py-2`) presque toujours juste au-dessus des boutons. |
| Autres | `LessonPanel.tsx:204,367` ; `OccurrenceActions.tsx:55-84` ; `PlanningPage.tsx:1123-1137` (bandeau d'erreur) ; `Filters.tsx:71-76` (« Effacer les filtres ») ; `UnavailabilitySection.tsx:101,129,179,206` ; « Modifications enregistrées. » inline (`SeasonForm.tsx:161,173`, `GroupForm.tsx:150`, `InstructorForm.tsx:194,260`) ; résultats de recherche `GroupPage.tsx:285-330` ; `<output>{message}` au-dessus des tableaux (`StudentsTab.tsx:125`, `SeasonTab.tsx:90`, `PrivacyCard.tsx:56`, `BackupCard.tsx:137`) ; `BackupCard.tsx:257,328` ; `Outputs.tsx:129,143` ; `StudentImport.tsx:275,415,479-505` ; `PdfPreviewDialog.tsx:90-98`. | Même motif. |

### Modales

- **Composant unique** : `src/components/ui/dialog.tsx:22-83`, wrapper maison sur `<dialog>` natif (`showModal()`, l.38), pas Radix. Contenu monté seulement si `open` (l.53) : la saisie est perdue à chaque fermeture. API : `open`, `onOpenChange`, `title`, `description`, `footer`, `className` ; ni `onCancel`, ni réglage du focus, ni garde « dirty ».
- **Focus initial (B3)** : la croix (`dialog.tsx:66-73`) est le premier focusable. Les `autoFocus` de `CourtsTab.tsx:179`, `LevelsTab.tsx:167`, `ClosuresTab.tsx:211` sont inopérants : React appelle `.focus()` au montage, avant le `showModal()` du `useEffect` (l.35-40) ; `showModal()` met alors le focus sur la croix. Les autres modales n'ont pas d'`autoFocus`.
- **Échap** : comportement natif (`cancel` → `close` → `onOpenChange(false)`, l.47), formulaire démonté. Un Échap destiné à un sélecteur date/heure natif ferme la modale (`ClosuresTab.tsx:222,232,340,349`, `UnavailabilitySection.tsx:173-211`, `SeasonForm.tsx:101,111`, `StudentForm.tsx:121`). Hors modale, `PlanningPage.tsx:848-858` ferme le panneau de cours sur Échap avant le filtre `isEditable` (l.869) : un Échap dans un champ du `LessonPanel` efface la saisie. Clic sur le fond : ne ferme pas.
- **Confirmation de fermeture** : aucune (ni suivi « dirty », ni `confirm()`). Seules confirmations : suppression (`DeleteAction.tsx:98-145`) et effacement RGPD (`StudentPrivacyDialog.tsx:146`).
- **Boutons grisés muets** : « Ajouter la plage » (`AvailabilityEditor.tsx:273,316`, `to <= from`, hors modale), `PdfPreviewDialog.tsx:81`, `WeekNavigator.tsx:76,87`. Annuler/Rétablir ont un `title`.
- **15 modales**, toutes sur `Dialog` : court, niveau, fermeture, assistant vacances, élève, groupe (×2, dont depuis le planning), moniteur, indisponibilité, saison, export/restauration de sauvegarde, suppression, RGPD, aperçu PDF. `LessonPanel` n'est pas une modale mais se comporte comme telle (croix l.194, Échap).

### Leviers communs

| Catégorie | Point unique |
|---|---|
| Focus, Échap, confirmation | `src/components/ui/dialog.tsx` couvre les 15 modales ; plus `LessonPanel` et `PlanningPage.tsx:851` à part. |
| Erreurs et aides de champ | `Field` / `ErrorAlert` (`src/components/form/Field.tsx`). |
| Avertissements, bandeaux, compteurs | aucun : composant « zone de message réservée » à créer ; cas repris un par un. |
| Boutons grisés | aucun : `Button` ne porte pas de raison de désactivation. |

Pas de hook de formulaire commun (`src/hooks/` : `useListState`, `useLoader`) : chaque formulaire gère son `useState`.
