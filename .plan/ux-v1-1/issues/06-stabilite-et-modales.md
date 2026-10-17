# Principe anti-décalage et règles des modales

Type: grilling
Status: resolved
Blocked by: 01

## Question

Quelle règle générale adopte-t-on pour que rien ne bouge sous le curseur, et quelles règles communes pour les modales ?

Décalage : réserver la place des messages conditionnels, les superposer, ou les remplacer par un toast / une bulle, selon le type de message (avertissement, compteur, bandeau) ? Modales : où va le focus initial, que fait Échap (fermer le sous-élément ouvert d'abord ? confirmer si la saisie est remplie ?), quand demander confirmation avant de fermer, comment expliquer un bouton grisé. Le principe retenu s'applique aussi aux nouvelles alertes de [Doublons et alerte d'âge](07-doublons-et-alerte-age.md).

## Answer

Grilling du 16/10/2026. Points d'appui dans le code : [Inventaire des décalages de mise en page et du comportement des modales](01-inventaire-decalages-et-modales.md).

### Principe anti-décalage

Rien ne bouge sous le curseur sans action volontaire de l'utilisatrice. Règle par type de message :

| Type | Règle |
|---|---|
| Avertissement en ligne (« Élève mineur… », avertissements du créneau de `LessonPanel`, badges de compteurs de `GroupPage`, nouvelles alertes de [Doublons et alerte d'âge](07-doublons-et-alerte-age.md)) | **Zone réservée** : composant commun à créer, hauteur fixe de 2 lignes réservée en permanence à l'emplacement du message, vide = blanc. Au-delà de 2 messages, la dernière ligne devient « + N autres avertissements », dépliable au clic (seul décalage admis, car volontaire). |
| Erreur générale de formulaire (`ErrorAlert`) | Dans la **même zone réservée**, au-dessus des boutons, prioritaire et en rouge. Un seul emplacement par formulaire ; les boutons ne bougent pas. |
| Erreur sous un champ (`Field`) | Décalage **toléré** : elle n'apparaît qu'après une validation, l'utilisatrice attend une réaction. |
| Barre de mode du planning (hachures, versions masquées, B7) | **Une ligne, hauteur fixe** ; les informations deviennent des pastilles courtes (« 1 moniteur indisponible », « 2 versions masquées »), détail en bulle au survol. |
| Confirmation de succès (« Modifications enregistrées. », `<output>{message}` au-dessus des tableaux, B11) | **Toast commun** à toute l'application (voir ci-dessous) ; les messages en ligne de succès disparaissent. |
| Bandeau d'erreur du planning (`PlanningPage.tsx:1123-1137`) | **Toast d'erreur**, qui reste jusqu'à fermeture. |
| Élément interactif conditionnel (« Effacer les filtres », résultats de recherche de `GroupPage`) | **Toujours présent** : bouton affiché et grisé quand inutile (avec raison, voir boutons grisés) ; résultats en liste déroulante superposée. |

Toast commun : en bas à droite (hors grille et pieds de modale) ; un seul visible, le nouveau remplace l'ancien ; succès effacés après ~4 s avec pause au survol ; erreurs persistantes jusqu'à fermeture ; annoncés en `aria-live`. Il remplace le toast propre au Planning (`PlanningPage.tsx:1171`).

### Règles des modales

S'appliquent aux 15 modales via `dialog.tsx` **et au panneau de cours** (`LessonPanel`), traité comme une modale.

- **Focus initial (B3)** : sur le premier champ de saisie, posé après `showModal()` ; sans champ (suppression, aperçu PDF), sur le bouton principal non destructif (Annuler pour une suppression).
- **Échap en cascade** : Échap ferme d'abord le sous-élément ouvert (sélecteur date/heure, liste déroulante) ; seul un Échap suivant s'adresse à la modale. Dans le panneau de cours, Échap tapé dans un champ ne ferme plus le panneau.
- **Confirmation de fermeture** : uniquement si la saisie diffère de son état à l'ouverture (garde « dirty » commune), quel que soit le moyen de fermer (Échap, croix, Annuler ; pour le panneau de cours, aussi la sélection d'un autre créneau). Fenêtre « Abandonner les modifications ? » avec « Continuer la saisie » (focus et Entrée) et « Abandonner ». Saisie intacte : fermeture directe.
- **Bouton grisé** : `Button` reçoit une prop `disabledReason`, affichée en petit texte visible à côté ou sous le bouton (dans une zone réservée) et en bulle au survol. Cas connus : « Ajouter la plage », aperçu PDF, navigation de semaines, « Effacer les filtres ».
