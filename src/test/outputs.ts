import type { Court } from "@/db/schema";
import type { PlanningState } from "@/domain/commands";
import type {
  OutputGroup,
  OutputInstructor,
  OutputReferences,
  OutputSeason,
  OutputStudent,
} from "@/features/pdf/model";
import { closure, exception, lesson, SEASON } from "./planning";

/**
 * Club de démonstration des sorties (PDF, exports, heures) :
 * - mercredi 14h00–15h30, Court 1, « Galaxie vert », Julie (JM) ;
 * - samedi 10h00–11h00, Court 2, « Adultes débutants », Karim (KB) ;
 * - vacances de la Toussaint du 17/10 au 01/11/2026, avec un stage de 3 h
 *   (cours ponctuel) le mercredi 21/10 assuré par Julie ;
 * - séance du mercredi 04/11 annulée (pluie), Marc (ML) remplace Karim le
 *   samedi 07/11, séance du mercredi 18/11 déplacée à 16h00.
 */
export const OUTPUT_SEASON: OutputSeason = {
  name: "2026-2027",
  ...SEASON,
  displayStartTime: "08:00",
  displayEndTime: "20:00",
  displayedDays: [1, 2, 3, 4, 5, 6],
};

const STAMP = "2026-08-01T00:00:00.000Z";

export const OUTPUT_COURTS: Court[] = [
  {
    id: "c1",
    seasonId: "saison",
    name: "Court 1",
    kind: "indoor",
    sortOrder: 0,
    active: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: "c2",
    seasonId: "saison",
    name: "Court central extérieur",
    kind: "outdoor",
    sortOrder: 1,
    active: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
];

export const OUTPUT_INSTRUCTORS: OutputInstructor[] = [
  {
    id: "m2",
    firstName: "Karim",
    lastName: "Benali",
    initials: "KB",
    color: "#C2410C",
    active: true,
  },
  {
    id: "m3",
    firstName: "Marc",
    lastName: "Leroy",
    initials: "ML",
    color: "#7E22CE",
    active: true,
  },
  {
    id: "m1",
    firstName: "Julie",
    lastName: "Martin",
    initials: "JM",
    color: "#1D4ED8",
    active: true,
  },
  {
    id: "m4",
    firstName: "Anne",
    lastName: "Ancienne",
    initials: "AA",
    color: "#475569",
    active: false,
  },
];

export const OUTPUT_GROUPS: OutputGroup[] = [
  {
    id: "g2",
    name: "Adultes débutants",
    levelLabel: null,
    minAge: 18,
    maxAge: null,
    maxSize: 6,
    memberCount: 2,
    active: true,
  },
  {
    id: "g1",
    name: "Galaxie vert",
    levelLabel: "Vert",
    minAge: 6,
    maxAge: 8,
    maxSize: 8,
    memberCount: 3,
    active: true,
  },
  {
    id: "g3",
    name: "Ancien groupe",
    levelLabel: null,
    minAge: null,
    maxAge: 12,
    maxSize: 4,
    memberCount: 0,
    active: false,
  },
];

export const OUTPUT_STUDENTS: OutputStudent[] = [
  {
    id: "s1",
    lastName: "Durand",
    firstName: "Zoé",
    phone: "06 11 22 33 44",
    birthDate: "2018-05-12",
    guardianName: "Claire Durand",
    guardianPhone: "06 99 88 77 66",
    groups: [{ id: "g1" }],
  },
  {
    id: "s2",
    lastName: "Éluard",
    firstName: "Léa",
    phone: "06 00 00 00 01",
    birthDate: null,
    guardianName: null,
    guardianPhone: null,
    groups: [{ id: "g1" }],
  },
  {
    id: "s3",
    lastName: "Bernard",
    firstName: "Tom",
    phone: "06 00 00 00 02",
    birthDate: "2017-01-03",
    guardianName: "Paul Bernard",
    guardianPhone: null,
    groups: [{ id: "g1" }, { id: "g2" }],
  },
  {
    id: "s4",
    lastName: "Martin",
    firstName: "Anne",
    phone: "06 00 00 00 03",
    birthDate: "1980-02-01",
    guardianName: null,
    guardianPhone: null,
    groups: [{ id: "g2" }],
  },
];

export const OUTPUT_REFS: OutputReferences = {
  courts: OUTPUT_COURTS,
  instructors: OUTPUT_INSTRUCTORS,
  groups: OUTPUT_GROUPS,
};

export const OUTPUT_STATE: PlanningState = {
  lessons: [
    lesson({ id: "mer", weekday: 3, startTime: "14:00", durationMinutes: 90 }),
    lesson({
      id: "sam",
      weekday: 6,
      startTime: "10:00",
      durationMinutes: 60,
      courtId: "c2",
      groupId: "g2",
      instructorId: "m2",
      note: "Prévoir les balles",
    }),
  ],
  exceptions: [
    exception({
      id: "stage",
      kind: "one_off",
      date: "2026-10-21",
      startTime: "09:00",
      durationMinutes: 180,
      courtId: "c1",
      instructorId: "m1",
    }),
    exception({
      id: "pluie",
      kind: "cancellation",
      lessonId: "mer",
      occurrenceDate: "2026-11-04",
      cancellationReason: "rain",
    }),
    exception({
      id: "remplacement",
      kind: "replacement",
      lessonId: "sam",
      occurrenceDate: "2026-11-07",
      instructorId: "m3",
    }),
    exception({
      id: "deplacement",
      kind: "modification",
      lessonId: "mer",
      occurrenceDate: "2026-11-18",
      startTime: "16:00",
    }),
  ],
  closures: [
    closure({
      id: "toussaint",
      label: "Vacances de la Toussaint",
      startDate: "2026-10-17",
      endDate: "2026-11-01",
    }),
  ],
};
