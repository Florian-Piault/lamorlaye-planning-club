import type { Db } from "@/db";
import { listCourts } from "@/db/repositories/courts";
import { type GroupListItem, listGroups, listMemberships } from "@/db/repositories/groups";
import { type InstructorWithAvailability, listInstructors } from "@/db/repositories/instructors";
import { listLevels } from "@/db/repositories/levels";
import { listStudents } from "@/db/repositories/students";
import type { Court, Level } from "@/db/schema";

/** Moniteur prêt pour les contrôles de disponibilité (semaine type : sans indisponibilités datées). */
export type PlanningInstructor = InstructorWithAvailability & {
  unavailabilities: readonly never[];
};

/** Référentiels de la saison utilisés par l'écran Planning. */
export interface PlanningReferences {
  courts: Court[];
  instructors: PlanningInstructor[];
  groups: GroupListItem[];
  students: { id: string; birthDate: string | null }[];
  memberships: { groupId: string; studentId: string }[];
  levels: Level[];
}

export async function loadPlanningReferences(
  db: Db,
  seasonId: string,
): Promise<PlanningReferences> {
  const [courts, instructors, groups, students, memberships, levels] = await Promise.all([
    listCourts(db, seasonId),
    listInstructors(db, seasonId),
    listGroups(db, seasonId),
    listStudents(db, seasonId),
    listMemberships(db, seasonId),
    listLevels(db),
  ]);
  return {
    courts,
    // En semaine type, seules les plages récurrentes comptent (§3.3).
    instructors: instructors.map((i) => ({ ...i, unavailabilities: [] })),
    groups,
    students: students.map((s) => ({ id: s.id, birthDate: s.birthDate })),
    memberships,
    levels,
  };
}
