-- Disponibilités hebdomadaires des élèves (docs/SPECS.md §3.5) : nouvelle table, calquée sur
-- `instructor_availabilities`, rattachée à l'élève avec suppression en cascade. Aucune table
-- existante n'est recréée.
-- La saison archivée reste en lecture seule (déclencheurs, comme en 0004) ; la suppression est
-- permise pendant l'effacement RGPD d'un élève (`student_erasures`), qui emporte ses plages
-- par la cascade.

CREATE TABLE `student_availabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "student_availabilities_weekday_check" CHECK(weekday between 1 and 7),
	CONSTRAINT "student_availabilities_times_check" CHECK("student_availabilities"."start_time" < "student_availabilities"."end_time")
);
--> statement-breakpoint
CREATE INDEX `student_availabilities_student_idx` ON `student_availabilities` (`student_id`);--> statement-breakpoint
CREATE TRIGGER `student_availabilities_archived_insert` BEFORE INSERT ON `student_availabilities`
WHEN (SELECT s.`status` FROM `students` st JOIN `seasons` s ON s.`id` = st.`season_id`
      WHERE st.`id` = NEW.`student_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `student_availabilities_archived_update` BEFORE UPDATE ON `student_availabilities`
WHEN (SELECT s.`status` FROM `students` st JOIN `seasons` s ON s.`id` = st.`season_id`
      WHERE st.`id` = OLD.`student_id`) = 'archived'
  OR (SELECT s.`status` FROM `students` st JOIN `seasons` s ON s.`id` = st.`season_id`
      WHERE st.`id` = NEW.`student_id`) = 'archived'
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
--> statement-breakpoint
CREATE TRIGGER `student_availabilities_archived_delete` BEFORE DELETE ON `student_availabilities`
WHEN (SELECT s.`status` FROM `students` st JOIN `seasons` s ON s.`id` = st.`season_id`
      WHERE st.`id` = OLD.`student_id`) = 'archived'
  AND NOT EXISTS (SELECT 1 FROM `student_erasures` WHERE `student_id` = OLD.`student_id`)
BEGIN SELECT RAISE(ABORT, 'Saison archivée : lecture seule.'); END;
