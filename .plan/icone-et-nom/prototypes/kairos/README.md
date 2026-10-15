# Prototype — icône et nom de l'application

**Question.** Quelle icône et quel nom pour l'application, jusque-là « Planning Club » (icône calendrier vert et orange, désaccordée du thème « court bleu ») ?

**Verdict.** Nom **Kairos**, dieu grec du moment opportun (le bon créneau). Icône **K4BE** : la paire d'ailes de la fresque de Salviati (bandes crème, sauge, saumon, bord de fuite festonné), sur la surface **dur vert/bleu**. Intégré dans `src-tauri/app-icon.svg`, `public/favicon.svg`, les icônes Tauri régénérées et tous les textes affichés.

## Cheminement

1. **Tour 1 (A–D)** : Planning Club refait, Court Central (court vu du dessus), Créneau, TCL Planning (blason). L'icône B (le court) est retenue, pas le nom.
2. **Tour 2** : icône B avec des noms en jeux de mots (Tamis, Emploi du Tennis, Courtier, À la volée, Cordage, Terrain d'entente, Ocre, Terre à terre) et cinq surfaces de court, réglables séparément. La terre battue plaît, le nom reste ouvert.
3. **Tour 3** : piste mythologique, Kairos. Icônes tirées de ses attributs : ailes (K1), mèche (K2), balle ailée (K3), plumage de la fresque (K4).
4. **Tour 4** : on approfondit K4 sans balle (grande aile, paire d'ailes, éventail, plume d'écriture), puis des variantes de la paire : trois ailes (K4B3, écartée), ailes plus écartées (K4BE), balle de profil avec une aile devant et une derrière (K4BB).
5. **Choix** : K4BE, surface dur vert/bleu.

## Fichiers

- `BrandPrototype.tsx` : toutes les icônes (tours 1 à 4), le sélecteur flottant et la planche (tailles de 256 à 16 px, Dock, onglet).
- `AppShell.patch` : comment le brancher dans la coque.

## Relancer

1. Copier `BrandPrototype.tsx` dans `src/components/layout/brand-prototype/`.
2. Appliquer les modifications décrites dans `AppShell.patch`.
3. Lancer `pnpm dev`, puis ouvrir `http://localhost:1420/?variant=K4BE&surface=us#/planning`. Les touches ← / → changent de variante ; les pastilles changent la surface ; « Planche » ouvre les icônes en grand. Les variantes des tours 1 à 3 sont dans `ROUND_1`, `ROUND_2` et `ROUND_3` : les remettre dans `BRAND_VARIANTS` pour les revoir.
