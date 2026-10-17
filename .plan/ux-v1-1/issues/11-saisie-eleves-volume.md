# Saisie des élèves en volume

Type: grilling
Status: resolved
Blocked by: 03, 07

## Question

Quels moyens offre-t-on pour saisir vite des dizaines d'élèves, et lesquels retient la v1.1 ?

Candidats : « Créer et ajouter un autre » dans le formulaire, collage depuis un tableur (réutiliser l'import ?), lien vers l'import depuis l'onglet Élèves et la fiche groupe, « Créer cet élève » depuis une recherche vide sur la fiche groupe, champ vidé après ajout, plus de retour forcé sur la fiche après création d'un groupe. Finitions rattachées : téléphone obligatoire avec responsable légal, niveau déduit du groupe, ordre Prénom / Nom commun. Les contrôles de [Doublons et alerte d'âge](07-doublons-et-alerte-age.md) doivent s'appliquer aussi à ces chemins rapides.

## Answer

Grilling du 16/10/2026, sur les faits d'[État de la saisie des élèves et de l'import](03-saisie-eleves-et-import.md). Les contrôles de [Doublons et alerte d'âge](07-doublons-et-alerte-age.md) s'appliquent tels quels à tous les chemins ci-dessous (vérification dès que nom et prénom sont saisis, y compris pré-remplis) ; confirmations par le toast commun de [Principe anti-décalage et règles des modales](06-stabilite-et-modales.md).

### Chemins rapides retenus

- **« Enregistrer et ajouter un autre »** dans le formulaire élève : toast « Léa Martin ajoutée », formulaire rouvert vide en **gardant les groupes cochés et le niveau**.
- **Collage tableur dans l'import** : l'étape 1 propose « Coller depuis Excel » à côté de « Choisir un fichier » ; même correspondance, même aperçu (doublons, tranches d'âge), même annulation (le texte collé passe par `importFile.ts` vers `planImport`).
  - **Sans ligne d'en-têtes** : détectée quand aucune cellule de la 1ʳᵉ ligne ne ressemble à un en-tête connu ; case « La première ligne contient des élèves » cochée (modifiable), colonnes nommées « Colonne A, B… » avec un aperçu de leurs valeurs, associées à l'étape suivante.
- **Liens vers l'import / le collage** : « Importer ou coller une liste » sur l'onglet Élèves (à côté de « Nouvel élève ») et sur la fiche groupe ; depuis la fiche, le groupe est pré-affecté si la liste n'a pas de colonne Groupe.
- **Fiche groupe, champ « Ajouter un élève »** : vidé après ajout, focus conservé ; Entrée ajoute le résultat unique ou celui en surbrillance (↑/↓) ; sans résultat, « Créer « Léa Martin » » ouvre le formulaire pré-rempli (prénom / nom découpés), groupe coché, retour à la fiche après enregistrement.
- **Après création d'un groupe** : plus d'ouverture forcée de la fiche ; on reste sur la liste, toast « Groupe Galaxie vert créé » avec le lien « Ajouter des élèves ».

### Finitions rattachées

- **Téléphone** : au moins un des deux, élève **ou** responsable légal (même règle à l'import). Amende `docs/SPECS.md` (fiche élève) ; colonne `students.phone` rendue nullable (migration). Affichage (liste, fiche groupe) : téléphone de l'élève, sinon celui du responsable suivi de « (resp.) » ; les exports gardent deux colonnes.
- **Niveau** : proposé depuis le premier groupe coché tant que l'utilisatrice ne l'a pas choisi (modèle de `suggestInitials`) ; l'import fait de même quand la colonne Niveau est vide.
- **Ordre Prénom / Nom** : Prénom puis Nom dans les formulaires élève et moniteur ; les listes triées affichent « Martin Léa ».
