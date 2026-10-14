CREATE TABLE `closures` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`label` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "closures_dates_check" CHECK("closures"."start_date" <= "closures"."end_date")
);
--> statement-breakpoint
CREATE INDEX `closures_season_idx` ON `closures` (`season_id`);--> statement-breakpoint
CREATE TABLE `courts` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'outdoor' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "courts_kind_check" CHECK(kind in ('indoor', 'outdoor'))
);
--> statement-breakpoint
CREATE INDEX `courts_season_idx` ON `courts` (`season_id`);--> statement-breakpoint
CREATE TABLE `group_students` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`student_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_students_unique_idx` ON `group_students` (`group_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `group_students_student_idx` ON `group_students` (`student_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`name` text NOT NULL,
	`level_id` text,
	`min_age` integer,
	`max_age` integer,
	`max_size` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "groups_max_size_check" CHECK("groups"."max_size" > 0),
	CONSTRAINT "groups_age_range_check" CHECK("groups"."min_age" is null or "groups"."max_age" is null or "groups"."min_age" <= "groups"."max_age")
);
--> statement-breakpoint
CREATE INDEX `groups_season_idx` ON `groups` (`season_id`);--> statement-breakpoint
CREATE TABLE `instructor_availabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`instructor_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "instructor_availabilities_weekday_check" CHECK(weekday between 1 and 7),
	CONSTRAINT "instructor_availabilities_times_check" CHECK("instructor_availabilities"."start_time" < "instructor_availabilities"."end_time")
);
--> statement-breakpoint
CREATE INDEX `instructor_availabilities_instructor_idx` ON `instructor_availabilities` (`instructor_id`);--> statement-breakpoint
CREATE TABLE `instructor_unavailabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`instructor_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`reason` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "instructor_unavailabilities_range_check" CHECK("instructor_unavailabilities"."starts_at" < "instructor_unavailabilities"."ends_at")
);
--> statement-breakpoint
CREATE INDEX `instructor_unavailabilities_instructor_idx` ON `instructor_unavailabilities` (`instructor_id`);--> statement-breakpoint
CREATE TABLE `instructors` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`last_name` text NOT NULL,
	`first_name` text NOT NULL,
	`phone` text,
	`email` text,
	`color` text NOT NULL,
	`initials` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `instructors_season_idx` ON `instructors` (`season_id`);--> statement-breakpoint
CREATE TABLE `lesson_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`kind` text NOT NULL,
	`lesson_id` text,
	`occurrence_date` text,
	`date` text,
	`start_time` text,
	`duration_minutes` integer,
	`court_id` text,
	`instructor_id` text,
	`group_id` text,
	`cancellation_reason` text,
	`cancellation_note` text,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "lesson_exceptions_kind_check" CHECK(kind in ('modification', 'cancellation', 'replacement', 'one_off')),
	CONSTRAINT "lesson_exceptions_reason_check" CHECK("lesson_exceptions"."cancellation_reason" is null or cancellation_reason in ('rain', 'instructor_absent', 'other')),
	CONSTRAINT "lesson_exceptions_target_check" CHECK(("lesson_exceptions"."kind" = 'one_off' and "lesson_exceptions"."lesson_id" is null and "lesson_exceptions"."date" is not null)
        or ("lesson_exceptions"."kind" <> 'one_off' and "lesson_exceptions"."lesson_id" is not null and "lesson_exceptions"."occurrence_date" is not null))
);
--> statement-breakpoint
CREATE INDEX `lesson_exceptions_season_idx` ON `lesson_exceptions` (`season_id`);--> statement-breakpoint
CREATE INDEX `lesson_exceptions_lesson_idx` ON `lesson_exceptions` (`lesson_id`,`occurrence_date`);--> statement-breakpoint
CREATE INDEX `lesson_exceptions_date_idx` ON `lesson_exceptions` (`date`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`start_time` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`court_id` text NOT NULL,
	`group_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`previous_lesson_id` text,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`previous_lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "lessons_weekday_check" CHECK(weekday between 1 and 7),
	CONSTRAINT "lessons_duration_check" CHECK("lessons"."duration_minutes" > 0 and "lessons"."duration_minutes" % 15 = 0),
	CONSTRAINT "lessons_effective_check" CHECK("lessons"."effective_to" is null or "lessons"."effective_from" <= "lessons"."effective_to")
);
--> statement-breakpoint
CREATE INDEX `lessons_season_idx` ON `lessons` (`season_id`);--> statement-breakpoint
CREATE INDEX `lessons_court_idx` ON `lessons` (`court_id`);--> statement-breakpoint
CREATE INDEX `lessons_group_idx` ON `lessons` (`group_id`);--> statement-breakpoint
CREATE INDEX `lessons_instructor_idx` ON `lessons` (`instructor_id`);--> statement-breakpoint
CREATE TABLE `levels` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`display_start_time` text DEFAULT '08:00' NOT NULL,
	`display_end_time` text DEFAULT '22:00' NOT NULL,
	`displayed_days` text DEFAULT '[1,2,3,4,5,6,7]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "seasons_status_check" CHECK(status in ('active', 'archived')),
	CONSTRAINT "seasons_dates_check" CHECK("seasons"."start_date" <= "seasons"."end_date")
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`last_name` text NOT NULL,
	`first_name` text NOT NULL,
	`phone` text NOT NULL,
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
CREATE INDEX `students_season_idx` ON `students` (`season_id`);--> statement-breakpoint
CREATE INDEX `students_identity_idx` ON `students` (`last_name`,`first_name`,`birth_date`);