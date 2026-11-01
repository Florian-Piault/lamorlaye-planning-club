import type { Db } from "@/db";
import { listCourts } from "@/db/repositories/courts";
import { type GroupListItem, listGroups, listMemberships } from "@/db/repositories/groups";
import {
  type InstructorWithAvailability,
  listInstructors,
  listSeasonUnavailabilities,
} from "@/db/repositories/instructors";
import { listLevels } from "@/db/repositories/levels";
import { listSeasonStudentAvailabilities, listStudents } from "@/db/repositories/students";
import type { Court, Level } from "@/db/schema";
import type { WeeklySlot } from "@/domain/availability";
import type { ConflictStudent } from "@/domain/conflicts";
import type { UnavailabilityRange } from "@/domain/unavailability";

/**
 * Moniteur prêt pour les contrôles de disponibilité : plages récurrentes et
 * indisponibilités datées. Ces dernières ne comptent que pour un créneau daté
 * (semaine datée) ; en semaine type, seules les plages récurrentes comptent (§3.3).
 */
export type PlanningInstructor = InstructorWithAvailability & {
  unavailabilities: readonly UnavailabilityRange[];
};

/** Référentiels de la saison utilisés par l'écran Planning. */
export interface PlanningReferences {
  courts: Court[];
  instructors: PlanningInstructor[];
  groups: GroupListItem[];
  /** Élèves avec leurs plages : âge et disponibilités (contrôles 6 et 7, §7). */
  students: ConflictStudent[];
  memberships: { groupId: string; studentId: string }[];
  levels: Level[];
}

export async function loadPlanningReferences(
  db: Db,
  seasonId: string,
): Promise<PlanningReferences> {
  const [
    courts,
    instructors,
    unavailabilities,
    groups,
    students,
    studentSlots,
    memberships,
    levels,
  ] = await Promise.all([
    listCourts(db, seasonId),
    listInstructors(db, seasonId),
    listSeasonUnavailabilities(db, seasonId),
    listGroups(db, seasonId),
    listStudents(db, seasonId),
    listSeasonStudentAvailabilities(db, seasonId),
    listMemberships(db, seasonId),
    listLevels(db),
  ]);
  const slotsByStudent = new Map<string, WeeklySlot[]>();
  for (const slot of studentSlots) {
    const list = slotsByStudent.get(slot.studentId) ?? [];
    list.push(slot);
    slotsByStudent.set(slot.studentId, list);
  }
  return {
    courts,
    instructors: instructors.map((i) => ({
      ...i,
      unavailabilities: unavailabilities.filter((u) => u.instructorId === i.id),
    })),
    groups,
    students: students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      birthDate: s.birthDate,
      availabilities: slotsByStudent.get(s.id) ?? [],
    })),
    memberships,
    levels,
  };
}
