# Vérifier l'aperçu PDF dans l'application de bureau

Type: task
Status: resolved

## Question

L'aperçu PDF noir (B13) se reproduit-il dans l'application de bureau, ou n'était-ce qu'une limite du navigateur de test ?

Checklist (humain) :

1. `pnpm tauri dev`.
2. Créer une saison, un court, un moniteur, un groupe et un cours.
3. Ouvrir l'aperçu PDF de la semaine, puis celui d'un planning moniteur et d'une feuille d'appel.
4. Noter pour chacun : aperçu lisible ou noir ; le PDF enregistré s'ouvre-t-il correctement ?

Si le bug se reproduit, il entre dans la spec ; sinon il sort du périmètre.

## Answer

Vérifié par l'utilisateur le 16/10/2026 dans `pnpm tauri dev` : les aperçus de la semaine, d'un planning moniteur et d'une feuille d'appel sont **tous lisibles**. B13 ne se reproduit pas dans l'application de bureau : c'était une limite du navigateur de test. Le bug sort du périmètre. L'ouverture du PDF enregistré n'a pas été notée séparément.
