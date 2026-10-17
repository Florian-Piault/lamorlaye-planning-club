# Doublons et alerte d'âge

Type: grilling
Status: resolved
Blocked by: 06

## Question

Quand et comment l'application signale-t-elle un doublon ou une incohérence d'âge, et est-ce bloquant ?

- Élève (B1) : qu'est-ce qu'un doublon (nom + prénom ? + date de naissance ?), avertissement ou blocage, et comment distinguer deux homonymes réels à la suppression.
- Moniteur (B2) : initiales déjà prises — suggestion automatique (« JMo ») ou simple avertissement.
- Court (B5) : nom déjà pris.
- Tranche d'âge : alerte dans le formulaire élève dès qu'un groupe hors tranche est coché, au lieu de la seule fiche groupe.

Cohérence attendue avec la philosophie actuelle des conflits (signalés tôt, jamais bloquants, en phrases claires ; `SPECS.md` §7). Amende `SPECS.md` si une règle métier change.

## Answer

Grilling du 16/10/2026. Faits d'appui : [État de la saisie des élèves et de l'import](03-saisie-eleves-et-import.md) ; élèves rattachés à une saison (`students.seasonId`, `src/db/schema.ts:229-253`) ; âge calculé au début de saison (`groupAlerts(group, members, season.startDate)`, `GroupPage.tsx:170`). Tous les messages ci-dessous vont dans la zone réservée de [Principe anti-décalage et règles des modales](06-stabilite-et-modales.md). Aucun contrôle n'est bloquant (`SPECS.md` §7 maintenu).

### Élève (B1)

- **Doublon** : même nom + prénom, sans casse ni accents ; si les deux dates de naissance sont connues, elles doivent aussi être égales (une date absente ne départage pas). Comparé aux élèves **de toutes les saisons**, la fiche éditée exclue. Vérifié dès que nom et prénom sont saisis, en création comme en modification.
- **Doublon dans la saison en cours** : avertissement « Un élève Martin Léa (née le 03/05/2015, Galaxie vert) existe déjà » + lien « Ouvrir sa fiche ». Le lien remplace le formulaire par la fiche existante, sous la confirmation d'abandon si la saisie est modifiée. Enregistrer reste possible (vrais homonymes).
- **Doublon seulement dans une saison passée** : ton informatif, « Léa Martin était inscrite en 2025-2026. Reprendre ses coordonnées ? ». Un clic pré-remplit téléphone, e-mail, naissance, responsable légal, niveau et classement depuis la saison la plus récente où elle figure ; pas les groupes.
- **Homonymes réels** : partout où un élève est désigné seul (confirmation de suppression, résultats de recherche, ajout à un groupe), afficher date de naissance et groupes dès qu'un homonyme existe ; toujours dans la confirmation de suppression.

### Moniteur (B2)

Initiales saisies déjà prises dans la saison : « JM est déjà utilisé par Jean Martin. Utiliser JMo ? » avec un bouton qui applique la proposition de `suggestInitials`. Enregistrement possible sans changer.

### Court (B5)

Nom déjà pris (sans casse ni accents) : « Un court « Court 2 » existe déjà ». Enregistrement possible.

### Tranche d'âge

- Âge à la date de début de saison, comme la fiche groupe et les conflits.
- Liste à cocher du formulaire élève : chaque groupe affiche sa tranche (« Galaxie vert · 6–8 ans ») ; ceux hors tranche pour l'élève portent une mention discrète « hors tranche », restent cochables, **ordre inchangé**. Sans date de naissance : tranches affichées, aucune mention.
- Groupe coché hors tranche, ou date saisie qui met hors tranche un groupe déjà coché : « Léa aura 11 ans, Galaxie vert est pour les 6–8 ans ».
- **Import** (et futur collage tableur) : l'aperçu marque les lignes dont un groupe affecté est hors tranche, avec un compteur en tête ; import non bloqué. Clé de doublon de l'import inchangée (nom + prénom + naissance, saison).

### Amendements de `SPECS.md`

- §7 : ajouter au tableau les doublons d'élève, d'initiales et de nom de court avec leurs messages types ; la règle « aucun conflit bloquant » reste entière.
- §8 : alerte d'âge dans le formulaire élève (liste et cochage) et dans l'aperçu d'import ; reprise des coordonnées d'un élève d'une saison passée.
