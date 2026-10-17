# État de la saisie des élèves et de l'import

Type: research
Status: resolved

## Question

Que permettent aujourd'hui le formulaire élève, l'ajout d'élèves depuis la fiche groupe et le pipeline d'import, et qu'est-ce qui serait réutilisable pour accélérer la saisie en volume ?

À établir : champs obligatoires du formulaire (téléphone obligatoire même avec responsable légal), parcours actuel et nombre d'actions par élève, comportement après création (liste vs fiche, retour forcé sur la fiche après création d'un groupe), champ « Ajouter un élève » de la fiche groupe (pas vidé après ajout, pas de « Créer cet élève » quand la recherche est vide, seul résultat non sélectionné), ordre Prénom / Nom entre moniteurs et élèves, niveau non déduit du groupe. Côté import (`src/features/import-export/`) : le pipeline (lecture, correspondance des colonnes, validation, détection de doublons éventuelle) peut-il accepter un texte collé depuis un tableur sans passer par un fichier ?

Sert à trancher [Saisie des élèves en volume](11-saisie-eleves-volume.md).

## Answer

Recherche dans le code (lecture seule), 16/10/2026.

### Formulaire élève

- Champs (`src/features/referentiels/eleves/StudentForm.tsx:116-151`) : Nom*, Prénom*, Téléphone*, E-mail, Date de naissance, Niveau, Classement FFT, bloc « Responsable légal » (nom, téléphone), groupes en cases à cocher (l.152-190, filtre au-delà de 6 groupes).
- `studentSchema` (`src/domain/validation.ts:143-153`) : nom, prénom, téléphone (≥ 6 chiffres, `requiredPhone` l.37-41) obligatoires **sans condition**, même avec un responsable légal ; responsable optionnel même pour un mineur (simple texte d'aide, `StudentForm.tsx:142-146`). En base `phone notNull` (`src/db/schema.ts:239`). `docs/SPECS.md:66-68` impose le téléphone et prévoit le responsable pour les mineurs : assouplir l'un ou l'autre est une règle métier.
- Après création : dialogue fermé, retour à la liste (`StudentsTab.tsx:194-200`) ; pas de « Créer et ajouter un autre », pas de toast, formulaire repart de zéro (`emptyStudentValues`, `StudentForm.tsx:19-29`).
- Niveau **non déduit** du groupe coché (`StudentForm.tsx:173-179`, `src/db/repositories/students.ts:59-89`), alors que le groupe porte un `levelId`.
- Ordre : élève Nom puis Prénom, moniteur Prénom puis Nom (`InstructorForm.tsx:106,115`) ; les listes affichent « Nom Prénom ».

### Groupes

- Création → `navigate(id)` forcé vers la fiche (`groupes/GroupsTab.tsx:178-182`).
- Fiche groupe, « Ajouter un élève » (`groupes/GroupPage.tsx:279-334`) : champ jamais vidé après ajout (`run`, l.145-153) ; recherche vide → « Aucun élève trouvé. » sans création possible (l.287-291) ; Entrée n'ajoute rien, pas de sélection auto du résultat unique (`SearchInput`, `src/components/data/ListControls.tsx:16-33`) ; 8 résultats max.

### Import

- Pipeline en 4 étapes (`StudentImport.tsx:45-52`) : lecture (`src/domain/importFile.ts` : Excel ou texte, encodage, séparateur `; , tab` détectés, en-têtes obligatoires, 10 000 lignes max) → correspondance (`guessMapping` par synonymes, mémorisée en localStorage) → aperçu `planImport` (`src/domain/studentImport.ts:459-618`, même `studentSchema`, statuts create/update/unchanged/duplicate/error) → écriture par une commande inversible (`buildImportCommand`, annulable).
- **Doublons déjà gérés à l'import** : `identityKey` = nom + prénom + date de naissance sans casse ni accents (l.318-328), contre la saison et dans le fichier, mode `ignore` ou `update`.
- Affectation aux groupes par la colonne « Groupe(s) » (`resolveGroups`, l.436-456) ; niveau par libellé.
- **Collage tableur faisable sans toucher au cœur** : `planImport` ne voit que des `TableRow[]` ; `parseCsv`/`detectDelimiter`/`toTable` ou `readImportFile(new TextEncoder().encode(text))` transforment un TSV collé en table. Seul couplage : l'interface attend un `SelectedFile` (`StudentImport.tsx:105-118`) et `FileFormat` n'a pas de variante « collé ». Contrainte : une ligne d'en-têtes est nécessaire.
- Aucun lien vers l'import depuis l'onglet Élèves ni la fiche groupe (seulement la navigation principale, `src/app/navigation.ts:35`).

### Doublons ailleurs

- Saisie manuelle d'élève : **aucun contrôle** ; index `students_identity_idx` non unique (`schema.ts:252`). `findStudentRecords` (`src/db/repositories/rgpd.ts:27-40`) rapproche déjà par identité, pour le RGPD.
- Moniteurs : `suggestInitials(first, last, taken)` propose déjà des initiales libres (`InstructorForm.tsx:68-77`, `src/domain/initials.ts:43-47`). Le doublon JM/JM du test (B2) vient donc d'une valeur saisie ou conservée par l'utilisateur, sans avertissement, plutôt que d'une absence de suggestion : à vérifier dans [Doublons et alerte d'âge](07-doublons-et-alerte-age.md).
- Courts : aucun contrôle (`validation.ts:92-96`).
- Fermetures : propositions « déjà saisie » décochées (`src/domain/schoolCalendar.ts:138-185`). Inscriptions : index unique (`schema.ts:270`).

### Briques réutilisables

`importFile.ts` (texte → table), `guessMapping`/`restoreMapping`/`mappingStorage`, `planImport` + `buildImportCommand` + `importHistory`, `identityKey`/`normalizePhone`/`parseImportDate` (pour avertir d'un doublon dans la fiche), étapes `MappingStep`/`PreviewStep`, `studentSchema`, `createStudent`/`addGroupMember`, `src/domain/search.ts`, `loadImportContext`, le modèle « valeur proposée tant que non modifiée » de `suggestInitials` (pour pré-remplir le niveau).
