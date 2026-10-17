-- Téléphone de l'élève facultatif (SPECS.md §3.5, v1.1) : règle « élève ou responsable légal »,
-- vérifiée par l'application (fiche et import). SQLite ne sait pas retirer un NOT NULL : la table
-- `students` est reconstruite, sans aucune perte.
--
-- Les migrations s'exécutent dans une transaction, clés étrangères actives (`PRAGMA foreign_keys`
-- y est sans effet). Supprimer `students` effacerait donc, par la cascade, toute la composition
-- des groupes. Pour l'éviter, `group_students` est reconstruite elle aussi, d'abord rattachée à la
-- nouvelle table des élèves ; le renommage final met à jour cette référence. Les déclencheurs de
-- lecture seule des saisons archivées (0004) disparaissent avec les tables et sont recréés à
-- l'identique, comme celui des niveaux, qui désigne `students` (recréé après le renommage).

DROP TRIGGER `levels_archived_delete`;
--> statement-breakpoint
CREATE TABLE `__new_students` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`last_name` text NOT NULL,
	`first_name` text NOT NULL,
	`phone` text,
	`birth_date` text,
	`level_id` text,
	`fft_ranking` text,
	`email` text,
	`guardian_name` text,
	`guardian_phone` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_students`("id", "season_id", "last_name", "first_name", "phone", "birth_date", "level_id", "fft_ranking", "email", "guardian_name", "guardian_phone", "created_at", "updated_at") SELECT "id", "season_id", "last_name", "first_name", "phone", "birth_date", "level_id", "fft_ranking", "email", "guardian_name", "guardian_phone", "created_at", "updated_at" FROM `students`;
--> statement-breakpoint
CREATE TABLE `__new_group_students` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`student_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `__new_students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_group_students`("id", "group_id", "student_id", "created_at", "updated_at") SELECT "id", "group_id", "student_id", "created_at", "updated_at" FROM `group_students`;
--> statement-breakpoint
-- Plus aucune table ne désigne l'ancienne table des élèves : sa suppression n'efface rien d'autre.
DROP TABLE `group_students`;
--> statement-breakpoint
DROP TABLE `students`;
--> statement-breakpoint
ALTER TABLE `__new_students` RENAME TO `students`;
--> statement-breakpoint
ALTER TABLE `__new_group_students` RENAME TO `group_students`;
--> statement-breakpoint
CREATE INDEX `students_season_idx` ON `students` (`season_id`);
--> statement-breakpoint
CREATE INDEX `students_identity_idx` ON `students` (`last_name`,`first_name`,`birth_date`);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_students_unique_idx` ON `group_students` (`group_id`,`student_id`);
--> statement-breakpoint
CREATE INDEX `group_students_student_idx` ON `group_students` (`student_id`);
--> statement-breakpoint

-- Déclencheurs de lecture seule (identiques à 0004).
CREATE TRIGGER `students_archived_insert` BEFORE INSERT ON `students`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `students_archived_update` BEFORE UPDATE ON `students`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
  OR (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `students_archived_delete` BEFORE DELETE ON `students`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
  AND NOT EXISTS (SELECT 1 FROM `student_erasures` WHERE `student_id` = OLD.`id`)
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `group_students_archived_insert` BEFORE INSERT ON `group_students`
WHEN (SELECT s.`status` FROM `groups` g JOIN `seasons` s ON s.`id` = g.`season_id`
      WHERE g.`id` = NEW.`group_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `group_students_archived_update` BEFORE UPDATE ON `group_students`
WHEN (SELECT s.`status` FROM `groups` g JOIN `seasons` s ON s.`id` = g.`season_id`
      WHERE g.`id` = OLD.`group_id`) = 'archived'
  OR (SELECT s.`status` FROM `groups` g JOIN `seasons` s ON s.`id` = g.`season_id`
      WHERE g.`id` = NEW.`group_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `group_students_archived_delete` BEFORE DELETE ON `group_students`
WHEN (SELECT s.`status` FROM `groups` g JOIN `seasons` s ON s.`id` = g.`season_id`
      WHERE g.`id` = OLD.`group_id`) = 'archived'
  AND NOT EXISTS (SELECT 1 FROM `student_erasures` WHERE `student_id` = OLD.`student_id`)
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `levels_archived_delete` BEFORE DELETE ON `levels`
WHEN EXISTS (SELECT 1 FROM `groups` g JOIN `seasons` s ON s.`id` = g.`season_id`
             WHERE g.`level_id` = OLD.`id` AND s.`status` = 'archived')
  OR EXISTS (SELECT 1 FROM `students` st JOIN `seasons` s ON s.`id` = st.`season_id`
             WHERE st.`level_id` = OLD.`id` AND s.`status` = 'archived')
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
