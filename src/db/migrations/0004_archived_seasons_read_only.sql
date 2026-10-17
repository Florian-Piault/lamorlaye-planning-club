-- Saisons archivées en lecture seule (docs/SPECS.md §3.1, §8.1) : garde-fou central, au niveau de la base.
-- Toute écriture (insertion, modification, suppression) touchant une saison archivée est refusée,
-- quel que soit l'écran ou la commande qui la demande. Le message est reconnu par l'application
-- (src/db/readOnly.ts) et traduit en SeasonReadOnlyError.
-- Seule exception : l'effacement RGPD d'un élève (§11.6), autorisé si l'élève est inscrit dans
-- `student_erasures` (dans la même transaction que la suppression).

-- Saisons : une saison archivée ne peut plus être modifiée ni supprimée.
CREATE TRIGGER `seasons_archived_update` BEFORE UPDATE ON `seasons`
WHEN OLD.`status` = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `seasons_archived_delete` BEFORE DELETE ON `seasons`
WHEN OLD.`status` = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint

-- Courts
CREATE TRIGGER `courts_archived_insert` BEFORE INSERT ON `courts`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `courts_archived_update` BEFORE UPDATE ON `courts`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
  OR (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `courts_archived_delete` BEFORE DELETE ON `courts`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint

-- Moniteurs
CREATE TRIGGER `instructors_archived_insert` BEFORE INSERT ON `instructors`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `instructors_archived_update` BEFORE UPDATE ON `instructors`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
  OR (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `instructors_archived_delete` BEFORE DELETE ON `instructors`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint

-- Disponibilités récurrentes des moniteurs (saison du moniteur)
CREATE TRIGGER `instructor_availabilities_archived_insert` BEFORE INSERT ON `instructor_availabilities`
WHEN (SELECT s.`status` FROM `instructors` i JOIN `seasons` s ON s.`id` = i.`season_id`
      WHERE i.`id` = NEW.`instructor_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `instructor_availabilities_archived_update` BEFORE UPDATE ON `instructor_availabilities`
WHEN (SELECT s.`status` FROM `instructors` i JOIN `seasons` s ON s.`id` = i.`season_id`
      WHERE i.`id` = OLD.`instructor_id`) = 'archived'
  OR (SELECT s.`status` FROM `instructors` i JOIN `seasons` s ON s.`id` = i.`season_id`
      WHERE i.`id` = NEW.`instructor_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `instructor_availabilities_archived_delete` BEFORE DELETE ON `instructor_availabilities`
WHEN (SELECT s.`status` FROM `instructors` i JOIN `seasons` s ON s.`id` = i.`season_id`
      WHERE i.`id` = OLD.`instructor_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint

-- Indisponibilités datées des moniteurs
CREATE TRIGGER `instructor_unavailabilities_archived_insert` BEFORE INSERT ON `instructor_unavailabilities`
WHEN (SELECT s.`status` FROM `instructors` i JOIN `seasons` s ON s.`id` = i.`season_id`
      WHERE i.`id` = NEW.`instructor_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `instructor_unavailabilities_archived_update` BEFORE UPDATE ON `instructor_unavailabilities`
WHEN (SELECT s.`status` FROM `instructors` i JOIN `seasons` s ON s.`id` = i.`season_id`
      WHERE i.`id` = OLD.`instructor_id`) = 'archived'
  OR (SELECT s.`status` FROM `instructors` i JOIN `seasons` s ON s.`id` = i.`season_id`
      WHERE i.`id` = NEW.`instructor_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `instructor_unavailabilities_archived_delete` BEFORE DELETE ON `instructor_unavailabilities`
WHEN (SELECT s.`status` FROM `instructors` i JOIN `seasons` s ON s.`id` = i.`season_id`
      WHERE i.`id` = OLD.`instructor_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint

-- Groupes
CREATE TRIGGER `groups_archived_insert` BEFORE INSERT ON `groups`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `groups_archived_update` BEFORE UPDATE ON `groups`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
  OR (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `groups_archived_delete` BEFORE DELETE ON `groups`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint

-- Élèves (suppression autorisée pour un effacement RGPD)
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

-- Composition des groupes (saison du groupe ; retrait autorisé pour un effacement RGPD)
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

-- Cours de la semaine type
CREATE TRIGGER `lessons_archived_insert` BEFORE INSERT ON `lessons`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `lessons_archived_update` BEFORE UPDATE ON `lessons`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
  OR (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `lessons_archived_delete` BEFORE DELETE ON `lessons`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint

-- Exceptions et cours ponctuels
CREATE TRIGGER `lesson_exceptions_archived_insert` BEFORE INSERT ON `lesson_exceptions`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `lesson_exceptions_archived_update` BEFORE UPDATE ON `lesson_exceptions`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
  OR (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `lesson_exceptions_archived_delete` BEFORE DELETE ON `lesson_exceptions`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint

-- Niveaux (communs à toutes les saisons) : la suppression d'un niveau retirerait, par la clé
-- étrangère (`set null`, sans déclencheur), le niveau des groupes et élèves d'une saison archivée.
CREATE TRIGGER `levels_archived_delete` BEFORE DELETE ON `levels`
WHEN EXISTS (SELECT 1 FROM `groups` g JOIN `seasons` s ON s.`id` = g.`season_id`
             WHERE g.`level_id` = OLD.`id` AND s.`status` = 'archived')
  OR EXISTS (SELECT 1 FROM `students` st JOIN `seasons` s ON s.`id` = st.`season_id`
             WHERE st.`level_id` = OLD.`id` AND s.`status` = 'archived')
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint

-- Périodes de fermeture
CREATE TRIGGER `closures_archived_insert` BEFORE INSERT ON `closures`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `closures_archived_update` BEFORE UPDATE ON `closures`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
  OR (SELECT `status` FROM `seasons` WHERE `id` = NEW.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `closures_archived_delete` BEFORE DELETE ON `closures`
WHEN (SELECT `status` FROM `seasons` WHERE `id` = OLD.`season_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
