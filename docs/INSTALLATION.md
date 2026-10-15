# Notice d'installation — Planning Club

> Version 1.0 — applicable à macOS, Windows et Linux.

Planning Club est une application de bureau **entièrement hors ligne** : elle ne se connecte jamais à internet, ne crée aucun compte et ne se met pas à jour toute seule. Les données restent sur le poste où elle est installée.

## Avant de commencer : binaires non signés

En version 1, les installateurs **ne sont pas signés** (pas de certificat Apple Developer ni de signature Microsoft, voir SPECS §11.1 et §12.2). Au premier lancement, macOS et Windows affichent donc un avertissement de sécurité. Ce n'est pas le signe d'un problème : la procédure ci-dessous permet d'autoriser l'application une fois pour toutes.

Téléchargez **uniquement** les installateurs publiés dans les *Releases* du dépôt GitHub du projet. En cas de doute sur un fichier, ne l'ouvrez pas.

| Système | Fichier à télécharger | Exemple de nom |
|---|---|---|
| macOS Apple Silicon (M1, M2…) | `.dmg` `aarch64` | `Planning Club_1.0.0_aarch64.dmg` |
| macOS Intel | `.dmg` `x64` | `Planning Club_1.0.0_x64.dmg` |
| Windows 10 / 11 (sans droits administrateur) | `.exe` | `Planning Club_1.0.0_x64-setup.exe` |
| Windows 10 / 11 (installation pour tous les utilisateurs) | `.msi` | `Planning Club_1.0.0_x64_fr-FR.msi` |
| Linux (toutes distributions) | `.AppImage` | `Planning Club_1.0.0_amd64.AppImage` |
| Linux Debian / Ubuntu | `.deb` | `Planning Club_1.0.0_amd64.deb` |

Pour savoir si votre Mac est Apple Silicon ou Intel : menu  › *À propos de ce Mac* › ligne *Puce* (Apple M…) ou *Processeur* (Intel).

Configuration minimale : écran de **1366 × 768** ou plus ; macOS récent, Windows 10 ou 11, Linux de type Ubuntu 22.04 / Debian 12 / Fedora 39 ou plus récent.

---

## macOS

### Installation

1. Ouvrez le fichier `.dmg` téléchargé.
2. Faites glisser **Planning Club** sur le dossier **Applications**.
3. Éjectez l'image disque (icône d'éjection dans le Finder).

### Premier lancement (Gatekeeper)

Au premier lancement, macOS indique que l'application « ne peut pas être ouverte car Apple ne peut pas vérifier qu'elle ne contient pas de logiciel malveillant ». Pour l'autoriser :

- **macOS 14 (Sonoma) et antérieurs** : dans le dossier *Applications*, faites un **clic droit** (ou Ctrl + clic) sur *Planning Club*, choisissez **Ouvrir**, puis confirmez avec **Ouvrir** dans la fenêtre d'avertissement.
- **macOS 15 (Sequoia) et suivants** : le clic droit ne suffit plus. Lancez l'application une première fois (l'avertissement s'affiche, fermez-le), puis ouvrez **Réglages Système › Confidentialité et sécurité**, descendez jusqu'à la section *Sécurité* et cliquez sur **Ouvrir quand même** en face de « Planning Club ». Confirmez avec votre mot de passe.

Ces étapes ne sont à faire qu'une fois : les lancements suivants se font normalement.

### Si macOS indique que l'application « est endommagée »

Ce message apparaît parfois pour une application non signée téléchargée par un navigateur (attribut de quarantaine). Ouvrez l'application **Terminal** et saisissez :

```sh
xattr -dr com.apple.quarantine "/Applications/Planning Club.app"
```

puis relancez Planning Club depuis le dossier *Applications*.

### Désinstallation

1. Quittez Planning Club.
2. Faites glisser *Planning Club* du dossier *Applications* vers la corbeille.
3. Les données ne sont **pas** supprimées (voir [Emplacement des données](#emplacement-des-données)). Pour les effacer aussi, supprimez le dossier `~/Library/Application Support/fr.tc-lamorlaye.planning` (dans le Finder : menu *Aller › Aller au dossier…*).

---

## Windows

Deux installateurs sont proposés :

- **`.exe` (recommandé)** : installation pour l'utilisateur courant, **sans droits administrateur** ;
- **`.msi`** : installation pour tous les utilisateurs du poste (droits administrateur requis), utile pour un déploiement par un service informatique.

### Installation et filtre SmartScreen

1. Double-cliquez sur le fichier téléchargé.
2. Windows affiche « **Windows a protégé votre ordinateur** » (Microsoft Defender SmartScreen). Cliquez sur **Informations complémentaires**, vérifiez que l'application est bien *Planning Club*, puis cliquez sur **Exécuter quand même**.
3. Suivez l'assistant d'installation. Un raccourci est créé dans le menu Démarrer.

Si le navigateur (Edge, Chrome) bloque le téléchargement, choisissez *Conserver* dans la liste des téléchargements (menu « … » › *Conserver* › *Conserver quand même*).

Planning Club utilise le composant **Microsoft Edge WebView2**, présent d'office sur Windows 11 et sur les Windows 10 à jour. S'il est absent, l'installateur l'installe : c'est la **seule** étape qui peut nécessiter une connexion internet, au moment de l'installation uniquement. L'application elle-même ne se connecte jamais.

### Désinstallation

1. **Paramètres › Applications › Applications installées** (ou *Panneau de configuration › Programmes et fonctionnalités*).
2. Choisissez *Planning Club* › **Désinstaller**.
3. Les données ne sont **pas** supprimées. Pour les effacer aussi, supprimez le dossier `%APPDATA%\fr.tc-lamorlaye.planning` (à coller dans la barre d'adresse de l'Explorateur).

---

## Linux

### AppImage (toutes distributions)

1. Rendez le fichier exécutable :

   ```sh
   chmod +x "Planning Club_1.0.0_amd64.AppImage"
   ```

   (ou, dans le gestionnaire de fichiers : clic droit › *Propriétés* › *Permissions* › *Autoriser l'exécution*).
2. Lancez-le par un double-clic ou depuis un terminal :

   ```sh
   ./"Planning Club_1.0.0_amd64.AppImage"
   ```

Sur Ubuntu 22.04 et suivants, si l'AppImage ne démarre pas en signalant `libfuse.so.2`, installez la bibliothèque FUSE 2 : `sudo apt install libfuse2` (Ubuntu 24.04 : `sudo apt install libfuse2t64`).

### Paquet .deb (Debian, Ubuntu et dérivées)

```sh
sudo apt install "./Planning Club_1.0.0_amd64.deb"
```

`apt` installe aussi les dépendances (WebKitGTK 4.1). L'application apparaît ensuite dans le menu des applications (catégorie *Bureautique*).

Fedora et autres distributions sans `.deb` : utilisez l'AppImage (WebKitGTK 4.1 doit être installé : `sudo dnf install webkit2gtk4.1`).

### Désinstallation

- AppImage : supprimez le fichier `.AppImage`.
- Paquet `.deb` : `sudo apt remove planning-club`.
- Dans les deux cas, les données ne sont **pas** supprimées : pour les effacer, supprimez `~/.local/share/fr.tc-lamorlaye.planning`.

---

## Emplacement des données

Toutes les données (référentiels, planning, sauvegardes) sont dans le dossier de données de l'application. L'écran **À propos** de l'application affiche ces chemins exacts.

| Système | Dossier de données |
|---|---|
| macOS | `~/Library/Application Support/fr.tc-lamorlaye.planning/` |
| Windows | `%APPDATA%\fr.tc-lamorlaye.planning\` (soit `C:\Users\<nom>\AppData\Roaming\fr.tc-lamorlaye.planning\`) |
| Linux | `~/.local/share/fr.tc-lamorlaye.planning/` (ou `$XDG_DATA_HOME/fr.tc-lamorlaye.planning/`) |

Ce dossier contient :

- `planning.db` : la base de données (SQLite) ;
- `sauvegardes/` : une copie automatique à **chaque fermeture** de l'application, les 30 dernières étant conservées (`planning-AAAA-MM-JJ_HH-MM-SS_fermeture.db`), ainsi que les copies faites à la demande depuis *Réglages* (`…_manuelle.db`) et avant chaque restauration (`…_avant-restauration.db`).

Les données d'élèves (dont des mineurs) sont des données personnelles : activez le chiffrement du disque du poste (**FileVault** sur macOS, **BitLocker** sur Windows, **LUKS** sur Linux) et préférez les sauvegardes exportées **chiffrées par mot de passe** (écran *Réglages*).

## Mise à jour vers une nouvelle version

1. Dans l'application, **Réglages › Exporter une sauvegarde…** (par précaution, vers une clé USB).
2. Quittez l'application, puis installez la nouvelle version par-dessus l'ancienne, de la même façon que la première installation (les mêmes avertissements peuvent réapparaître).
3. Au premier lancement, le format des données est mis à jour automatiquement (migrations) ; vos données sont conservées.

## Changer de poste

1. Sur l'ancien poste : **Réglages › Exporter une sauvegarde…** (chiffrée de préférence) vers une clé USB.
2. Sur le nouveau poste : installez Planning Club, puis **Réglages › Restaurer une sauvegarde…** et choisissez le fichier (le mot de passe est demandé pour une sauvegarde chiffrée).

## En cas de problème

- **L'application ne démarre plus** : les sauvegardes automatiques sont dans le dossier `sauvegardes/` ci-dessus ; après réinstallation, restaurez la plus récente depuis *Réglages*.
- **Mot de passe d'une sauvegarde chiffrée oublié** : il ne peut pas être retrouvé ; utilisez une autre sauvegarde (les sauvegardes automatiques ne sont pas chiffrées, elles restent sur le poste).
