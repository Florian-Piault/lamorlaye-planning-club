import type { Db } from "@/db";
import { listCourts } from "@/db/repositories/courts";
import { type GroupListItem, listGroups } from "@/db/repositories/groups";
import { type InstructorWithAvailability, listInstructors } from "@/db/repositories/instructors";
import { listStudents, type StudentListItem } from "@/db/repositories/students";
import type { Court, Season } from "@/db/schema";
import type { PlanningState } from "@/domain/commands";
import { PlanningStore } from "@/features/planning/store";

/** Données de la saison nécessaires aux documents PDF, aux exports et au récapitulatif des heures. */
export interface OutputData {
  season: Season;
  state: PlanningState;
  courts: Court[];
  instructors: InstructorWithAvailability[];
  groups: GroupListItem[];
  students: StudentListItem[];
}

/**
 * Charge le planning et les référentiels de la saison. Le planning est relu
 * après les écritures encore en cours de l'écran Planning (`PlanningStore`).
 */
export async function loadOutputData(db: Db, season: Season): Promise<OutputData> {
  const [store, courts, instructors, groups, students] = await Promise.all([
    PlanningStore.load(db, season.id),
    listCourts(db, season.id),
    listInstructors(db, season.id),
    listGroups(db, season.id),
    listStudents(db, season.id),
  ]);
  return { season, state: store.getSnapshot().state, courts, instructors, groups, students };
}
