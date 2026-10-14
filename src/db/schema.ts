/**
 * Schéma de la base SQLite (SPECS.md §3).
 *
 * Conventions :
 * - chaque table porte un identifiant UUID (`id`) et les horodatages
 *   `created_at` / `updated_at` (ISO 8601, UTC) pour préparer une future
 *   synchronisation (§11.4) ;
 * - les colonnes TypeScript sont en camelCase, converties en snake_case par
 *   Drizzle (`casing: "snake_case"`) ;
 * - dates : `AAAA-MM-JJ` ; heures : `HH:MM` ; date-heures : ISO 8601 ;
 * - jours de la semaine : numérotation ISO (1 = lundi … 7 = dimanche).
 */
import { relations, sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Colonnes communes
// ---------------------------------------------------------------------------

/** Horodatage courant au format ISO 8601 UTC, identique côté SQL et côté TypeScript. */
const nowSql = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const nowIso = (): string => new Date().toISOString();

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: text().notNull().default(nowSql),
  updatedAt: text().notNull().default(nowSql).$onUpdateFn(nowIso),
};

/** Booléen stocké en entier 0/1. */
const flag = () => integer({ mode: "boolean" });

// ---------------------------------------------------------------------------
// Énumérations
// ---------------------------------------------------------------------------

export const seasonStatuses = ["active", "archived"] as const;
export type SeasonStatus = (typeof seasonStatuses)[number];

export const courtKinds = ["indoor", "outdoor"] as const;
export type CourtKind = (typeof courtKinds)[number];

export const exceptionKinds = ["modification", "cancellation", "replacement", "one_off"] as const;
export type ExceptionKind = (typeof exceptionKinds)[number];

export const cancellationReasons = ["rain", "instructor_absent", "other"] as const;
export type CancellationReason = (typeof cancellationReasons)[number];

const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);

const weekdayCheck = (column: string) => sql.raw(`${column} between 1 and 7`);

// ---------------------------------------------------------------------------
// 3.1 Saison
// ---------------------------------------------------------------------------

export const seasons = sqliteTable(
  "seasons",
  {
    id: id(),
    name: text().notNull(),
    startDate: text().notNull(),
    endDate: text().notNull(),
    status: text({ enum: seasonStatuses }).notNull().default("active"),
    /** Amplitude horaire affichée dans la grille. */
    displayStartTime: text().notNull().default("08:00"),
    displayEndTime: text().notNull().default("22:00"),
    /** Jours affichés (tableau JSON de jours ISO), par défaut lundi → dimanche. */
    displayedDays: text({ mode: "json" })
      .$type<number[]>()
      .notNull()
      .default(sql`'[1,2,3,4,5,6,7]'`),
    ...timestamps,
  },
  (t) => [
    check("seasons_status_check", inList("status", seasonStatuses)),
    check("seasons_dates_check", sql`${t.startDate} <= ${t.endDate}`),
    /** Une seule saison active à la fois. */
    uniqueIndex("seasons_single_active_idx").on(t.status).where(sql`status = 'active'`),
  ],
);

// ---------------------------------------------------------------------------
// 3.2 Court
// ---------------------------------------------------------------------------

export const courts = sqliteTable(
  "courts",
  {
    id: id(),
    seasonId: text()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    name: text().notNull(),
    /** Couvert / extérieur (informatif). */
    kind: text({ enum: courtKinds }).notNull().default("outdoor"),
    sortOrder: integer().notNull().default(0),
    active: flag().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("courts_season_idx").on(t.seasonId),
    check("courts_kind_check", inList("kind", courtKinds)),
  ],
);

// ---------------------------------------------------------------------------
// 3.3 Moniteur et disponibilités
// ---------------------------------------------------------------------------

export const instructors = sqliteTable(
  "instructors",
  {
    id: id(),
    seasonId: text()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    lastName: text().notNull(),
    firstName: text().notNull(),
    phone: text(),
    email: text(),
    /** Couleur de la palette (§6), au format `#RRGGBB`. */
    color: text().notNull(),
    /** Initiales calculées à la création, modifiables. */
    initials: text().notNull(),
    active: flag().notNull().default(true),
    ...timestamps,
  },
  (t) => [index("instructors_season_idx").on(t.seasonId)],
);

/** Plages hebdomadaires récurrentes de disponibilité. */
export const instructorAvailabilities = sqliteTable(
  "instructor_availabilities",
  {
    id: id(),
    instructorId: text()
      .notNull()
      .references(() => instructors.id, { onDelete: "cascade" }),
    weekday: integer().notNull(),
    startTime: text().notNull(),
    endTime: text().notNull(),
    ...timestamps,
  },
  (t) => [
    index("instructor_availabilities_instructor_idx").on(t.instructorId),
    check("instructor_availabilities_weekday_check", weekdayCheck("weekday")),
    check("instructor_availabilities_times_check", sql`${t.startTime} < ${t.endTime}`),
  ],
);

/** Indisponibilités datées (congé, maladie, tournoi…). */
export const instructorUnavailabilities = sqliteTable(
  "instructor_unavailabilities",
  {
    id: id(),
    instructorId: text()
      .notNull()
      .references(() => instructors.id, { onDelete: "cascade" }),
    startsAt: text().notNull(),
    endsAt: text().notNull(),
    reason: text(),
    ...timestamps,
  },
  (t) => [
    index("instructor_unavailabilities_instructor_idx").on(t.instructorId),
    check("instructor_unavailabilities_range_check", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

// ---------------------------------------------------------------------------
// 3.5 bis Référentiel des niveaux (commun à toutes les saisons)
// ---------------------------------------------------------------------------

export const levels = sqliteTable("levels", {
  id: id(),
  label: text().notNull(),
  sortOrder: integer().notNull().default(0),
  active: flag().notNull().default(true),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// 3.4 Groupe
// ---------------------------------------------------------------------------

export const groups = sqliteTable(
  "groups",
  {
    id: id(),
    seasonId: text()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    name: text().notNull(),
    levelId: text().references(() => levels.id, { onDelete: "set null" }),
    minAge: integer(),
    maxAge: integer(),
    maxSize: integer().notNull(),
    active: flag().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("groups_season_idx").on(t.seasonId),
    check("groups_max_size_check", sql`${t.maxSize} > 0`),
    check(
      "groups_age_range_check",
      sql`${t.minAge} is null or ${t.maxAge} is null or ${t.minAge} <= ${t.maxAge}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 3.5 Élève
// ---------------------------------------------------------------------------

export const students = sqliteTable(
  "students",
  {
    id: id(),
    seasonId: text()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    lastName: text().notNull(),
    firstName: text().notNull(),
    phone: text().notNull(),
    birthDate: text(),
    levelId: text().references(() => levels.id, { onDelete: "set null" }),
    /** Classement FFT, ex. « 30/2 ». */
    fftRanking: text(),
    email: text(),
    /** Responsable légal (élèves mineurs). */
    guardianName: text(),
    guardianPhone: text(),
    ...timestamps,
  },
  (t) => [
    index("students_season_idx").on(t.seasonId),
    index("students_identity_idx").on(t.lastName, t.firstName, t.birthDate),
  ],
);

/** Composition des groupes (relation N-N groupe ↔ élève). */
export const groupStudents = sqliteTable(
  "group_students",
  {
    id: id(),
    groupId: text()
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    studentId: text()
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("group_students_unique_idx").on(t.groupId, t.studentId),
    index("group_students_student_idx").on(t.studentId),
  ],
);

// ---------------------------------------------------------------------------
// 3.6 Cours (semaine type)
// ---------------------------------------------------------------------------

export const lessons = sqliteTable(
  "lessons",
  {
    id: id(),
    seasonId: text()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    weekday: integer().notNull(),
    startTime: text().notNull(),
    /** Durée en minutes, par pas de 15 min. */
    durationMinutes: integer().notNull(),
    courtId: text()
      .notNull()
      .references(() => courts.id, { onDelete: "restrict" }),
    groupId: text()
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    instructorId: text()
      .notNull()
      .references(() => instructors.id, { onDelete: "restrict" }),
    /** Dates d'effet : permettent « Appliquer à partir de » (§5.4). Fin incluse, nulle = sans fin. */
    effectiveFrom: text().notNull(),
    effectiveTo: text(),
    /** Version précédente du cours, en cas de « Appliquer à partir de ». */
    previousLessonId: text().references((): AnySQLiteColumn => lessons.id, {
      onDelete: "set null",
    }),
    note: text(),
    ...timestamps,
  },
  (t) => [
    index("lessons_season_idx").on(t.seasonId),
    index("lessons_court_idx").on(t.courtId),
    index("lessons_group_idx").on(t.groupId),
    index("lessons_instructor_idx").on(t.instructorId),
    check("lessons_weekday_check", weekdayCheck("weekday")),
    check(
      "lessons_duration_check",
      sql`${t.durationMinutes} > 0 and ${t.durationMinutes} % 15 = 0`,
    ),
    check(
      "lessons_effective_check",
      sql`${t.effectiveTo} is null or ${t.effectiveFrom} <= ${t.effectiveTo}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 3.7 Exception sur une occurrence datée
// ---------------------------------------------------------------------------

/**
 * - `modification` : nouvelle date/heure/durée/court/moniteur pour une occurrence ;
 * - `cancellation` : annulation avec motif ;
 * - `replacement` : moniteur remplaçant (`instructorId`) ;
 * - `one_off` : cours ponctuel autonome (`lessonId` nul, groupe optionnel).
 *
 * Les colonnes de valeur (`date`, `startTime`…) sont nulles quand elles ne
 * s'appliquent pas au type ; la cohérence fine est vérifiée par le domaine.
 */
export const lessonExceptions = sqliteTable(
  "lesson_exceptions",
  {
    id: id(),
    seasonId: text()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    kind: text({ enum: exceptionKinds }).notNull(),
    /** Cours de la semaine type concerné (nul pour un cours ponctuel). */
    lessonId: text().references(() => lessons.id, { onDelete: "cascade" }),
    /** Date d'origine de l'occurrence concernée (nulle pour un cours ponctuel). */
    occurrenceDate: text(),
    /** Nouvelle date (modification) ou date du cours ponctuel. */
    date: text(),
    startTime: text(),
    durationMinutes: integer(),
    courtId: text().references(() => courts.id, { onDelete: "restrict" }),
    instructorId: text().references(() => instructors.id, { onDelete: "restrict" }),
    groupId: text().references(() => groups.id, { onDelete: "restrict" }),
    cancellationReason: text({ enum: cancellationReasons }),
    cancellationNote: text(),
    note: text(),
    ...timestamps,
  },
  (t) => [
    index("lesson_exceptions_season_idx").on(t.seasonId),
    index("lesson_exceptions_lesson_idx").on(t.lessonId, t.occurrenceDate),
    index("lesson_exceptions_date_idx").on(t.date),
    check("lesson_exceptions_kind_check", inList("kind", exceptionKinds)),
    check(
      "lesson_exceptions_reason_check",
      sql`${t.cancellationReason} is null or ${inList("cancellation_reason", cancellationReasons)}`,
    ),
    check(
      "lesson_exceptions_target_check",
      sql`(${t.kind} = 'one_off' and ${t.lessonId} is null and ${t.date} is not null)
        or (${t.kind} <> 'one_off' and ${t.lessonId} is not null and ${t.occurrenceDate} is not null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 3.8 Période de fermeture
// ---------------------------------------------------------------------------

export const closures = sqliteTable(
  "closures",
  {
    id: id(),
    seasonId: text()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    label: text().notNull(),
    startDate: text().notNull(),
    endDate: text().notNull(),
    ...timestamps,
  },
  (t) => [
    index("closures_season_idx").on(t.seasonId),
    check("closures_dates_check", sql`${t.startDate} <= ${t.endDate}`),
  ],
);

// ---------------------------------------------------------------------------
// Relations (requêtes relationnelles Drizzle)
// ---------------------------------------------------------------------------

export const seasonsRelations = relations(seasons, ({ many }) => ({
  courts: many(courts),
  instructors: many(instructors),
  groups: many(groups),
  students: many(students),
  lessons: many(lessons),
  exceptions: many(lessonExceptions),
  closures: many(closures),
}));

export const courtsRelations = relations(courts, ({ one }) => ({
  season: one(seasons, { fields: [courts.seasonId], references: [seasons.id] }),
}));

export const instructorsRelations = relations(instructors, ({ one, many }) => ({
  season: one(seasons, { fields: [instructors.seasonId], references: [seasons.id] }),
  availabilities: many(instructorAvailabilities),
  unavailabilities: many(instructorUnavailabilities),
}));

export const instructorAvailabilitiesRelations = relations(instructorAvailabilities, ({ one }) => ({
  instructor: one(instructors, {
    fields: [instructorAvailabilities.instructorId],
    references: [instructors.id],
  }),
}));

export const instructorUnavailabilitiesRelations = relations(
  instructorUnavailabilities,
  ({ one }) => ({
    instructor: one(instructors, {
      fields: [instructorUnavailabilities.instructorId],
      references: [instructors.id],
    }),
  }),
);

export const groupsRelations = relations(groups, ({ one, many }) => ({
  season: one(seasons, { fields: [groups.seasonId], references: [seasons.id] }),
  level: one(levels, { fields: [groups.levelId], references: [levels.id] }),
  members: many(groupStudents),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  season: one(seasons, { fields: [students.seasonId], references: [seasons.id] }),
  level: one(levels, { fields: [students.levelId], references: [levels.id] }),
  memberships: many(groupStudents),
}));

export const groupStudentsRelations = relations(groupStudents, ({ one }) => ({
  group: one(groups, { fields: [groupStudents.groupId], references: [groups.id] }),
  student: one(students, { fields: [groupStudents.studentId], references: [students.id] }),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  season: one(seasons, { fields: [lessons.seasonId], references: [seasons.id] }),
  court: one(courts, { fields: [lessons.courtId], references: [courts.id] }),
  group: one(groups, { fields: [lessons.groupId], references: [groups.id] }),
  instructor: one(instructors, { fields: [lessons.instructorId], references: [instructors.id] }),
  exceptions: many(lessonExceptions),
}));

export const lessonExceptionsRelations = relations(lessonExceptions, ({ one }) => ({
  season: one(seasons, { fields: [lessonExceptions.seasonId], references: [seasons.id] }),
  lesson: one(lessons, { fields: [lessonExceptions.lessonId], references: [lessons.id] }),
  court: one(courts, { fields: [lessonExceptions.courtId], references: [courts.id] }),
  instructor: one(instructors, {
    fields: [lessonExceptions.instructorId],
    references: [instructors.id],
  }),
  group: one(groups, { fields: [lessonExceptions.groupId], references: [groups.id] }),
}));

export const closuresRelations = relations(closures, ({ one }) => ({
  season: one(seasons, { fields: [closures.seasonId], references: [seasons.id] }),
}));

// ---------------------------------------------------------------------------
// Types dérivés
// ---------------------------------------------------------------------------

export type Season = typeof seasons.$inferSelect;
export type NewSeason = typeof seasons.$inferInsert;
export type Court = typeof courts.$inferSelect;
export type NewCourt = typeof courts.$inferInsert;
export type Instructor = typeof instructors.$inferSelect;
export type NewInstructor = typeof instructors.$inferInsert;
export type InstructorAvailability = typeof instructorAvailabilities.$inferSelect;
export type InstructorUnavailability = typeof instructorUnavailabilities.$inferSelect;
export type Level = typeof levels.$inferSelect;
export type NewLevel = typeof levels.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type GroupStudent = typeof groupStudents.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
export type LessonException = typeof lessonExceptions.$inferSelect;
export type NewLessonException = typeof lessonExceptions.$inferInsert;
export type Closure = typeof closures.$inferSelect;
export type NewClosure = typeof closures.$inferInsert;
