/**
 * Jeu de données à la volumétrie cible de la V1 (docs/SPECS.md §11.5) : 10 courts,
 * 20 moniteurs, 60 groupes, 500 élèves et 150 cours dans la semaine type,
 * plus des exceptions et les vacances de la saison 2026-2027.
 *
 * Utilisé par les tests de charge Vitest (domaine et sql.js) et, via
 * `src/test/e2e.ts`, par les scénarios Playwright.
 */
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "@/db";
import {
  type Closure,
  closures,
  courts,
  groupStudents,
  groups,
  instructorAvailabilities,
  instructors,
  instructorUnavailabilities,
  type Lesson,
  type LessonException,
  lessonExceptions,
  lessons,
  students,
} from "@/db/schema";
import { INSTRUCTOR_PALETTE } from "@/domain/colors";
import type { PlanningState } from "@/domain/commands";
import type { ConflictReferences } from "@/domain/conflicts";
import { addDays } from "@/domain/time";

export const TARGET_VOLUME = {
  courts: 10,
  instructors: 20,
  groups: 60,
  students: 500,
  lessons: 150,
} as const;

/** Saison de référence (le 01/09/2026 est un mardi). */
export const VOLUME_SEASON = { startDate: "2026-09-01", endDate: "2027-06-30" };

/** Premier lundi de la saison : semaines datées des exceptions. */
const FIRST_MONDAY = "2026-09-07";

const STAMP = "2026-08-01T00:00:00.000Z";

const LAST_NAMES = [
  "Martin",
  "Bernard",
  "Dubois",
  "Thomas",
  "Robert",
  "Richard",
  "Petit",
  "Durand",
  "Leroy",
  "Moreau",
  "Simon",
  "Laurent",
  "Lefèvre",
  "Michel",
  "Garcia",
  "David",
  "Bertrand",
  "Roux",
  "Vincent",
  "Fournier",
];
const FIRST_NAMES = [
  "Léa",
  "Hugo",
  "Chloé",
  "Louis",
  "Zoé",
  "Gabriel",
  "Inès",
  "Raphaël",
  "Jade",
  "Arthur",
  "Manon",
  "Noé",
  "Éloïse",
  "Jules",
  "Anaïs",
  "Théo",
  "Camille",
  "Adam",
  "Lina",
  "Maël",
  "Rémi",
  "Sacha",
  "Agathe",
  "Côme",
  "Mila",
];

function pick<T>(list: readonly T[], i: number): T {
  return list[i % list.length] as T;
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export interface VolumeData {
  courts: (typeof courts.$inferInsert & { id: string; name: string })[];
  instructors: (typeof instructors.$inferInsert & {
    id: string;
    firstName: string;
    lastName: string;
    initials: string;
    color: string;
  })[];
  availabilities: (typeof instructorAvailabilities.$inferInsert & {
    id: string;
    instructorId: string;
    weekday: number;
    startTime: string;
    endTime: string;
  })[];
  unavailabilities: (typeof instructorUnavailabilities.$inferInsert & {
    id: string;
    instructorId: string;
    startsAt: string;
    endsAt: string;
  })[];
  groups: (typeof groups.$inferInsert & {
    id: string;
    name: string;
    maxSize: number;
    minAge: number | null;
    maxAge: number | null;
  })[];
  students: (typeof students.$inferInsert & {
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;
  })[];
  memberships: { groupId: string; studentId: string }[];
  lessons: (typeof lessons.$inferInsert & {
    id: string;
    weekday: number;
    startTime: string;
    durationMinutes: number;
    courtId: string;
    groupId: string;
    instructorId: string;
    effectiveFrom: string;
  })[];
  exceptions: (typeof lessonExceptions.$inferInsert & { id: string })[];
  closures: (typeof closures.$inferInsert & {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
  })[];
}

/**
 * Club à la volumétrie cible, déterministe. Les identifiants sont préfixés par
 * `prefix` pour pouvoir charger plusieurs saisons dans la même base.
 */
export function buildVolumeData(seasonId: string, prefix = "v"): VolumeData {
  const id = (kind: string, i: number) => `${prefix}-${kind}-${i}`;
  const stamps = { createdAt: STAMP, updatedAt: STAMP };

  const courtRows = Array.from({ length: TARGET_VOLUME.courts }, (_, i) => ({
    id: id("court", i),
    seasonId,
    name: `Court ${i + 1}`,
    kind: i < 4 ? ("indoor" as const) : ("outdoor" as const),
    sortOrder: i,
    active: true,
    ...stamps,
  }));

  const instructorRows = Array.from({ length: TARGET_VOLUME.instructors }, (_, i) => {
    const firstName = `${pick(FIRST_NAMES, i * 3)}`;
    const lastName = `${pick(LAST_NAMES, i)}`;
    return {
      id: id("instructor", i),
      seasonId,
      firstName,
      lastName,
      phone: `06${String(i).padStart(8, "0")}`,
      email: null,
      color: pick(INSTRUCTOR_PALETTE, i).value,
      initials: `${firstName[0]}${lastName[0]}`.toUpperCase(),
      active: true,
      ...stamps,
    };
  });

  // Plages hebdomadaires : du lundi au samedi, matin et fin d'après-midi.
  const availabilityRows = instructorRows.flatMap((instructor, i) =>
    [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
      {
        id: id("availability", i * 20 + weekday * 2),
        instructorId: instructor.id,
        weekday,
        startTime: "09:00",
        endTime: "12:30",
        ...stamps,
      },
      {
        id: id("availability", i * 20 + weekday * 2 + 1),
        instructorId: instructor.id,
        weekday,
        startTime: i % 3 === 0 ? "14:00" : "16:00",
        endTime: i % 2 === 0 ? "21:30" : "20:00",
        ...stamps,
      },
    ]),
  );

  const unavailabilityRows = instructorRows
    .filter((_, i) => i % 4 === 0)
    .map((instructor, i) => {
      const start = addDays(FIRST_MONDAY, 7 * (4 + i * 3));
      return {
        id: id("unavailability", i),
        instructorId: instructor.id,
        startsAt: `${start}T00:00`,
        endsAt: `${addDays(start, 3)}T00:00`,
        reason: "Tournoi",
        ...stamps,
      };
    });

  const groupRows = Array.from({ length: TARGET_VOLUME.groups }, (_, i) => {
    const youth = i < 40;
    const minAge = youth ? 5 + (i % 12) : null;
    return {
      id: id("group", i),
      seasonId,
      name: youth ? `Galaxie ${i + 1}` : `Adultes ${i - 39}`,
      levelId: null,
      minAge,
      maxAge: minAge === null ? null : minAge + 3,
      maxSize: youth ? 8 : 6,
      active: true,
      ...stamps,
    };
  });

  const studentRows = Array.from({ length: TARGET_VOLUME.students }, (_, i) => {
    const group = i % TARGET_VOLUME.groups;
    const youth = group < 40;
    const birthYear = youth ? 2026 - (6 + (group % 12)) : 1970 + (i % 30);
    return {
      id: id("student", i),
      seasonId,
      lastName: pick(LAST_NAMES, i * 7),
      firstName: `${pick(FIRST_NAMES, i)} ${i + 1}`,
      phone: `07${String(i).padStart(8, "0")}`,
      birthDate: `${birthYear}-${String(1 + (i % 12)).padStart(2, "0")}-15`,
      levelId: null,
      fftRanking: youth ? null : pick(["NC", "40", "30/5", "30/2", "15/4"], i),
      email: null,
      guardianName: youth ? `Parent ${i + 1}` : null,
      guardianPhone: youth ? "0600000000" : null,
      ...stamps,
    };
  });

  // Chaque élève dans un groupe, un sur trois dans un deuxième groupe.
  const memberships = studentRows.flatMap((student, i) => {
    const first = id("group", i % TARGET_VOLUME.groups);
    const second = id("group", (i * 7 + 3) % TARGET_VOLUME.groups);
    return [
      { groupId: first, studentId: student.id },
      ...(i % 3 === 0 && second !== first ? [{ groupId: second, studentId: student.id }] : []),
    ];
  });

  // 150 cours : 25 par jour du lundi au samedi, répartis sur les 10 courts.
  const lessonRows = Array.from({ length: TARGET_VOLUME.lessons }, (_, i) => {
    const weekday = 1 + (i % 6);
    const rank = Math.floor(i / 6);
    const court = rank % TARGET_VOLUME.courts;
    const slot = Math.floor(rank / TARGET_VOLUME.courts);
    const start = weekday === 3 || weekday === 6 ? 9 * 60 + slot * 90 : 17 * 60 + slot * 75;
    return {
      id: id("lesson", i),
      seasonId,
      weekday,
      startTime: hhmm(start),
      durationMinutes: slot === 2 ? 90 : 60,
      courtId: id("court", court),
      groupId: id("group", i % TARGET_VOLUME.groups),
      instructorId: id("instructor", (i * 7) % TARGET_VOLUME.instructors),
      effectiveFrom: VOLUME_SEASON.startDate,
      effectiveTo: null,
      previousLessonId: null,
      note: null,
      ...stamps,
    };
  });

  // Exceptions réparties sur la saison : annulations, remplacements, cours ponctuels.
  const exceptionRows = Array.from({ length: 40 }, (_, i) => {
    const lesson = lessonRows[(i * 11) % lessonRows.length] as VolumeData["lessons"][number];
    const occurrenceDate = addDays(FIRST_MONDAY, 7 * (i % 30) + (lesson.weekday - 1));
    const base = { id: id("exception", i), seasonId, ...stamps };
    switch (i % 4) {
      case 0:
        return {
          ...base,
          kind: "cancellation" as const,
          lessonId: lesson.id,
          occurrenceDate,
          cancellationReason: "rain" as const,
        };
      case 1:
        return {
          ...base,
          kind: "replacement" as const,
          lessonId: lesson.id,
          occurrenceDate,
          instructorId: id("instructor", (i + 5) % TARGET_VOLUME.instructors),
        };
      case 2:
        return {
          ...base,
          kind: "modification" as const,
          lessonId: lesson.id,
          occurrenceDate,
          date: occurrenceDate,
          startTime: "12:00",
          durationMinutes: lesson.durationMinutes,
          courtId: lesson.courtId,
          instructorId: lesson.instructorId,
          groupId: lesson.groupId,
        };
      default:
        return {
          ...base,
          kind: "one_off" as const,
          date: occurrenceDate,
          startTime: "13:00",
          durationMinutes: 120,
          courtId: id("court", i % TARGET_VOLUME.courts),
          instructorId: id("instructor", i % TARGET_VOLUME.instructors),
          groupId: null,
        };
    }
  });

  // Vacances scolaires de la zone B et jours fériés de 2026-2027.
  const closureRows = [
    ["Vacances de la Toussaint", "2026-10-17", "2026-11-01"],
    ["Armistice", "2026-11-11", "2026-11-11"],
    ["Vacances de Noël", "2026-12-19", "2027-01-03"],
    ["Vacances d'hiver", "2027-02-20", "2027-03-07"],
    ["Vacances de printemps", "2027-04-17", "2027-05-02"],
    ["Ascension", "2027-05-06", "2027-05-09"],
  ].map(([label, startDate, endDate], i) => ({
    id: id("closure", i),
    seasonId,
    label: label as string,
    startDate: startDate as string,
    endDate: endDate as string,
    ...stamps,
  }));

  return {
    courts: courtRows,
    instructors: instructorRows,
    availabilities: availabilityRows,
    unavailabilities: unavailabilityRows,
    groups: groupRows,
    students: studentRows,
    memberships,
    lessons: lessonRows,
    exceptions: exceptionRows,
    closures: closureRows,
  };
}

/** Cours, exceptions et fermetures sous la forme lue en base (champs absents à `null`). */
export function volumePlanningState(data: VolumeData): PlanningState {
  return {
    lessons: data.lessons as Lesson[],
    exceptions: data.exceptions.map(
      (e) =>
        ({
          lessonId: null,
          occurrenceDate: null,
          date: null,
          startTime: null,
          durationMinutes: null,
          courtId: null,
          instructorId: null,
          groupId: null,
          cancellationReason: null,
          cancellationNote: null,
          note: null,
          ...e,
        }) as LessonException,
    ),
    closures: data.closures as Closure[],
  };
}

/** Référentiels des contrôles de conflits (§7). */
export function volumeConflictReferences(data: VolumeData): ConflictReferences {
  return {
    courts: data.courts,
    instructors: data.instructors.map((instructor) => ({
      id: instructor.id,
      firstName: instructor.firstName,
      availabilities: data.availabilities.filter((a) => a.instructorId === instructor.id),
      unavailabilities: data.unavailabilities.filter((u) => u.instructorId === instructor.id),
    })),
    groups: data.groups,
    students: data.students,
    memberships: data.memberships,
    referenceDate: VOLUME_SEASON.startDate,
  };
}

/** Lignes insérées par requête (variables SQLite largement sous la limite). */
const CHUNK = 50;

function chunked<T>(rows: readonly T[], insert: (part: T[]) => BatchItem<"sqlite">) {
  const statements: BatchItem<"sqlite">[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) statements.push(insert(rows.slice(i, i + CHUNK)));
  return statements;
}

/** Insère le club à la volumétrie cible dans la saison `seasonId` (une transaction). */
export async function seedVolumeData(db: Db, seasonId: string, prefix = "v"): Promise<VolumeData> {
  const data = buildVolumeData(seasonId, prefix);
  const [first, ...rest] = [
    ...chunked(data.courts, (part) => db.insert(courts).values(part)),
    ...chunked(data.instructors, (part) => db.insert(instructors).values(part)),
    ...chunked(data.availabilities, (part) => db.insert(instructorAvailabilities).values(part)),
    ...chunked(data.unavailabilities, (part) => db.insert(instructorUnavailabilities).values(part)),
    ...chunked(data.groups, (part) => db.insert(groups).values(part)),
    ...chunked(data.students, (part) => db.insert(students).values(part)),
    ...chunked(data.memberships, (part) => db.insert(groupStudents).values(part)),
    ...chunked(data.lessons, (part) => db.insert(lessons).values(part)),
    ...chunked(data.exceptions, (part) => db.insert(lessonExceptions).values(part)),
    ...chunked(data.closures, (part) => db.insert(closures).values(part)),
  ];
  await db.batch([first as BatchItem<"sqlite">, ...rest]);
  return data;
}

/**
 * Durée médiane (ms) de `run`, après quelques exécutions de chauffe : moins
 * sensible qu'une mesure unique aux à-coups de la machine (CI). Avec la
 * variable d'environnement `CHARGE_VERBOSE=1`, la mesure est affichée.
 */
export async function medianDuration(
  run: () => unknown,
  { runs = 11, warmup = 2, label }: { runs?: number; warmup?: number; label?: string } = {},
): Promise<number> {
  for (let i = 0; i < warmup; i++) await run();
  const timings: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await run();
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  const median = timings[Math.floor(timings.length / 2)] as number;
  if (label && typeof process !== "undefined" && process.env.CHARGE_VERBOSE) {
    console.info(`[charge] ${label} : ${median.toFixed(2)} ms`);
  }
  return median;
}
