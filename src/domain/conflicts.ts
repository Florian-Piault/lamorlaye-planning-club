/**
 * Conflits et avertissements (docs/SPECS.md §7). Aucun conflit n'est bloquant :
 * chacun produit un message affiché sur le cours et dans le panneau
 * « Avertissements ».
 *
 * Les six contrôles :
 * 1. court déjà occupé sur tout ou partie du créneau ;
 * 2. moniteur ayant déjà un cours sur le créneau ;
 * 3. moniteur hors de ses disponibilités (récurrentes ou datées) ;
 * 4. élèves inscrits dans deux cours simultanés (de groupes différents : un
 *    groupe encadré par deux moniteurs sur deux courts n'est pas un conflit) ;
 * 5. effectif du groupe supérieur au maximum ;
 * 6. âge d'un élève hors de la tranche du groupe.
 *
 * Les contrôles portent sur des créneaux (`PlanningSlot`) : cours de la
 * semaine type (`date` nulle) ou occurrences actives d'une semaine datée.
 * Deux créneaux se chevauchent s'ils ont lieu le même jour et que leurs
 * intervalles `[début, fin[` se recoupent.
 */
import { type Interval, intervalsOfDay } from "./availability";
import { type GroupLimits, groupAlerts } from "./groups";
import type { InstructorAvailabilityData } from "./instructorAvailability";
import type { LessonRecord, Occurrence } from "./occurrences";
import { timeToMinutes } from "./time";
import {
  localDateTime,
  overlappingUnavailabilities,
  type UnavailabilityRange,
} from "./unavailability";

// ---------------------------------------------------------------------------
// Créneaux
// ---------------------------------------------------------------------------

export interface PlanningSlot {
  /** Identifiant du cours (semaine type) ou clé de l'occurrence (semaine datée). */
  id: string;
  date: string | null;
  weekday: number;
  /** Minutes depuis minuit, `[start, end[`. */
  start: number;
  end: number;
  courtId: string | null;
  groupId: string | null;
  instructorId: string | null;
}

export function slotFromLesson(lesson: LessonRecord): PlanningSlot {
  const start = timeToMinutes(lesson.startTime);
  return {
    id: lesson.id,
    date: null,
    weekday: lesson.weekday,
    start,
    end: start + lesson.durationMinutes,
    courtId: lesson.courtId,
    groupId: lesson.groupId,
    instructorId: lesson.instructorId,
  };
}

export function slotFromOccurrence(occurrence: Occurrence): PlanningSlot {
  return {
    id: occurrence.key,
    date: occurrence.date,
    weekday: occurrence.weekday,
    start: occurrence.start,
    end: occurrence.end,
    courtId: occurrence.courtId,
    groupId: occurrence.groupId,
    instructorId: occurrence.instructorId,
  };
}

/** Créneaux d'une semaine datée : seules les occurrences actives peuvent être en conflit. */
export function slotsFromOccurrences(occurrences: readonly Occurrence[]): PlanningSlot[] {
  return occurrences.filter((o) => o.status === "active").map(slotFromOccurrence);
}

function dayKey(slot: PlanningSlot): string {
  return slot.date ?? `jour-${slot.weekday}`;
}

export function slotsOverlap(a: PlanningSlot, b: PlanningSlot): boolean {
  return a.id !== b.id && dayKey(a) === dayKey(b) && a.start < b.end && b.start < a.end;
}

// ---------------------------------------------------------------------------
// Référentiels utiles aux contrôles
// ---------------------------------------------------------------------------

export interface ConflictReferences {
  courts: readonly { id: string; name: string }[];
  instructors: readonly ({ id: string; firstName: string } & InstructorAvailabilityData)[];
  groups: readonly ({ id: string; name: string } & GroupLimits)[];
  students: readonly { id: string; birthDate: string | null }[];
  memberships: readonly { groupId: string; studentId: string }[];
  /** Date de calcul des âges (en pratique, le début de la saison). */
  referenceDate: string;
}

interface IndexedInstructor {
  firstName: string;
  weekly: Map<number, Interval[]>;
  unavailabilities: readonly UnavailabilityRange[];
}

/** Référentiels préparés une fois pour toutes les vérifications d'une semaine. */
export interface ConflictIndex {
  courtNames: Map<string, string>;
  groupNames: Map<string, string>;
  instructors: Map<string, IndexedInstructor>;
  members: Map<string, readonly string[]>;
  /** Messages d'effectif et d'âge, par groupe. */
  groupMessages: Map<string, { overCapacity: string | null; ageRange: string | null }>;
}

export function createConflictIndex(refs: ConflictReferences): ConflictIndex {
  const members = new Map<string, string[]>();
  for (const m of refs.memberships) {
    const list = members.get(m.groupId) ?? [];
    list.push(m.studentId);
    members.set(m.groupId, list);
  }
  const studentsById = new Map(refs.students.map((s) => [s.id, s]));
  const groupMessages = new Map<string, { overCapacity: string | null; ageRange: string | null }>();
  for (const group of refs.groups) {
    const groupStudents = (members.get(group.id) ?? []).map((id) => ({
      birthDate: studentsById.get(id)?.birthDate ?? null,
    }));
    const alerts = groupAlerts(group, groupStudents, refs.referenceDate);
    groupMessages.set(group.id, {
      overCapacity: alerts.overCapacity ? (alerts.messages[0] as string) : null,
      ageRange: alerts.outOfAgeRange > 0 ? (alerts.messages.at(-1) as string) : null,
    });
  }
  const instructors = new Map<string, IndexedInstructor>();
  for (const instructor of refs.instructors) {
    const weekly = new Map<number, Interval[]>();
    for (let weekday = 1; weekday <= 7; weekday++) {
      weekly.set(weekday, intervalsOfDay(instructor.availabilities, weekday));
    }
    instructors.set(instructor.id, {
      firstName: instructor.firstName,
      weekly,
      unavailabilities: instructor.unavailabilities,
    });
  }
  return {
    courtNames: new Map(refs.courts.map((c) => [c.id, c.name])),
    groupNames: new Map(refs.groups.map((g) => [g.id, g.name])),
    instructors,
    members,
    groupMessages,
  };
}

// ---------------------------------------------------------------------------
// Conflits
// ---------------------------------------------------------------------------

export type ConflictKind =
  | "court_occupied"
  | "instructor_busy"
  | "instructor_unavailable"
  | "students_overlap"
  | "over_capacity"
  | "age_range";

export interface Conflict {
  kind: ConflictKind;
  message: string;
  /** Créneaux en cause (chevauchements). */
  slotIds: string[];
}

/** 14 h 00 → « 14h00 ». */
function clock(minutes: number): string {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

function courtConflict(slot: PlanningSlot, other: PlanningSlot, index: ConflictIndex): Conflict {
  const court = index.courtNames.get(slot.courtId ?? "") ?? "Court";
  const occupant = other.groupId
    ? (index.groupNames.get(other.groupId) ?? "un autre cours")
    : "un cours ponctuel";
  return {
    kind: "court_occupied",
    message: `${court} déjà occupé par ${occupant} (${clock(other.start)}–${clock(other.end)})`,
    slotIds: [other.id],
  };
}

function instructorBusyConflict(other: PlanningSlot, index: ConflictIndex): Conflict {
  const name = index.instructors.get(other.instructorId ?? "")?.firstName ?? "Le moniteur";
  return {
    kind: "instructor_busy",
    message: `${name} a déjà un cours à ${clock(other.start)}`,
    slotIds: [other.id],
  };
}

function availabilityConflict(slot: PlanningSlot, index: ConflictIndex): Conflict | null {
  if (!slot.instructorId) return null;
  const instructor = index.instructors.get(slot.instructorId);
  if (!instructor) return null;
  const covered = (instructor.weekly.get(slot.weekday) ?? []).some(
    (i) => i.start <= slot.start && slot.end <= i.end,
  );
  const unavailable =
    slot.date !== null &&
    overlappingUnavailabilities(
      instructor.unavailabilities,
      localDateTime(slot.date, slot.start),
      localDateTime(slot.date, slot.end),
    ).length > 0;
  if (covered && !unavailable) return null;
  return {
    kind: "instructor_unavailable",
    message: `Hors disponibilités de ${instructor.firstName}`,
    slotIds: [],
  };
}

function studentsConflict(count: number, slotIds: string[]): Conflict {
  return {
    kind: "students_overlap",
    message:
      count === 1
        ? "1 élève a un autre cours sur ce créneau"
        : `${count} élèves ont un autre cours sur ce créneau`,
    slotIds,
  };
}

function groupConflicts(slot: PlanningSlot, index: ConflictIndex): Conflict[] {
  const messages = slot.groupId ? index.groupMessages.get(slot.groupId) : undefined;
  const result: Conflict[] = [];
  if (messages?.overCapacity) {
    result.push({ kind: "over_capacity", message: messages.overCapacity, slotIds: [] });
  }
  if (messages?.ageRange) {
    result.push({ kind: "age_range", message: messages.ageRange, slotIds: [] });
  }
  return result;
}

interface SlotState {
  conflicts: Conflict[];
  sharedStudents: Set<string>;
  studentSlotIds: string[];
}

/** Contrôles d'une paire de créneaux qui se chevauchent, du point de vue de `slot`. */
function checkPair(
  slot: PlanningSlot,
  other: PlanningSlot,
  state: SlotState,
  index: ConflictIndex,
): void {
  if (slot.courtId !== null && slot.courtId === other.courtId) {
    state.conflicts.push(courtConflict(slot, other, index));
  }
  if (slot.instructorId !== null && slot.instructorId === other.instructorId) {
    state.conflicts.push(instructorBusyConflict(other, index));
  }
  if (slot.groupId !== null && other.groupId !== null && slot.groupId !== other.groupId) {
    const otherMembers = index.members.get(other.groupId);
    if (otherMembers && otherMembers.length > 0) {
      const mine = new Set(index.members.get(slot.groupId) ?? []);
      let found = false;
      for (const student of otherMembers) {
        if (mine.has(student)) {
          state.sharedStudents.add(student);
          found = true;
        }
      }
      if (found) state.studentSlotIds.push(other.id);
    }
  }
}

function finish(slot: PlanningSlot, state: SlotState, index: ConflictIndex): Conflict[] {
  const conflicts = [...state.conflicts];
  const availability = availabilityConflict(slot, index);
  if (availability) conflicts.push(availability);
  if (state.sharedStudents.size > 0) {
    conflicts.push(studentsConflict(state.sharedStudents.size, state.studentSlotIds));
  }
  conflicts.push(...groupConflicts(slot, index));
  return conflicts;
}

const emptyState = (): SlotState => ({
  conflicts: [],
  sharedStudents: new Set(),
  studentSlotIds: [],
});

/**
 * Conflits d'un seul créneau face aux autres (aperçu pendant un glisser) :
 * `others` peut contenir le créneau lui-même (même `id`), qui est ignoré.
 */
export function detectSlotConflicts(
  slot: PlanningSlot,
  others: readonly PlanningSlot[],
  index: ConflictIndex,
): Conflict[] {
  const state = emptyState();
  for (const other of others) {
    if (slotsOverlap(slot, other)) checkPair(slot, other, state, index);
  }
  return finish(slot, state, index);
}

/**
 * Conflits de tous les créneaux d'une semaine. Renvoie, pour chaque créneau
 * en conflit, la liste de ses avertissements (les créneaux sans conflit sont absents).
 */
export function detectConflicts(
  slots: readonly PlanningSlot[],
  index: ConflictIndex,
): Map<string, Conflict[]> {
  const states = new Map<string, SlotState>(slots.map((s) => [s.id, emptyState()]));
  const byDay = new Map<string, PlanningSlot[]>();
  for (const slot of slots) {
    const key = dayKey(slot);
    const list = byDay.get(key) ?? [];
    list.push(slot);
    byDay.set(key, list);
  }
  for (const daySlots of byDay.values()) {
    daySlots.sort((a, b) => a.start - b.start);
    for (let i = 0; i < daySlots.length; i++) {
      const a = daySlots[i] as PlanningSlot;
      for (let j = i + 1; j < daySlots.length; j++) {
        const b = daySlots[j] as PlanningSlot;
        if (b.start >= a.end) break;
        checkPair(a, b, states.get(a.id) as SlotState, index);
        checkPair(b, a, states.get(b.id) as SlotState, index);
      }
    }
  }
  const result = new Map<string, Conflict[]>();
  for (const slot of slots) {
    const conflicts = finish(slot, states.get(slot.id) as SlotState, index);
    if (conflicts.length > 0) result.set(slot.id, conflicts);
  }
  return result;
}

/** Liste à plat pour le panneau « Avertissements », dans l'ordre des créneaux. */
export function conflictList(
  slots: readonly PlanningSlot[],
  conflicts: Map<string, Conflict[]>,
): { slotId: string; conflict: Conflict }[] {
  return slots.flatMap((slot) =>
    (conflicts.get(slot.id) ?? []).map((conflict) => ({ slotId: slot.id, conflict })),
  );
}
