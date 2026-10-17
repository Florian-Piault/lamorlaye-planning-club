import { asc, eq } from "drizzle-orm";
import { normalizeSlots, type WeeklySlot } from "@/domain/availability";
import { pickInstructorColor } from "@/domain/colors";
import { suggestInitials } from "@/domain/initials";
import type { UnavailabilityRange } from "@/domain/unavailability";
import type { Usage } from "@/domain/usage";
import type { InstructorInput } from "@/domain/validation";
import type { Db } from "../client";
import {
  type Instructor,
  type InstructorAvailability,
  type InstructorUnavailability,
  instructorAvailabilities,
  instructors,
  instructorUnavailabilities,
  lessonExceptions,
  lessons,
} from "../schema";
import { usageOf } from "./common";

export interface InstructorWithAvailability extends Instructor {
  availabilities: InstructorAvailability[];
}

export interface InstructorDetail extends InstructorWithAvailability {
  unavailabilities: InstructorUnavailability[];
}

/** Moniteurs de la saison avec leurs plages hebdomadaires. */
export async function listInstructors(
  db: Db,
  seasonId: string,
): Promise<InstructorWithAvailability[]> {
  const [rows, slots] = await Promise.all([
    db
      .select()
      .from(instructors)
      .where(eq(instructors.seasonId, seasonId))
      .orderBy(asc(instructors.lastName), asc(instructors.firstName)),
    db
      .select({ slot: instructorAvailabilities })
      .from(instructorAvailabilities)
      .innerJoin(instructors, eq(instructors.id, instructorAvailabilities.instructorId))
      .where(eq(instructors.seasonId, seasonId))
      .orderBy(asc(instructorAvailabilities.weekday), asc(instructorAvailabilities.startTime)),
  ]);
  return rows.map((instructor) => ({
    ...instructor,
    availabilities: slots.map((s) => s.slot).filter((s) => s.instructorId === instructor.id),
  }));
}

/** Indisponibilités datées de tous les moniteurs de la saison (semaines datées, §4.4, §7). */
export async function listSeasonUnavailabilities(
  db: Db,
  seasonId: string,
): Promise<InstructorUnavailability[]> {
  const rows = await db
    .select({ unavailability: instructorUnavailabilities })
    .from(instructorUnavailabilities)
    .innerJoin(instructors, eq(instructors.id, instructorUnavailabilities.instructorId))
    .where(eq(instructors.seasonId, seasonId))
    .orderBy(asc(instructorUnavailabilities.startsAt));
  return rows.map((r) => r.unavailability);
}

export async function getInstructor(db: Db, id: string): Promise<InstructorDetail | undefined> {
  const instructor = await db.query.instructors.findFirst({ where: eq(instructors.id, id) });
  if (!instructor) return undefined;
  const [availabilities, unavailabilities] = await Promise.all([
    db
      .select()
      .from(instructorAvailabilities)
      .where(eq(instructorAvailabilities.instructorId, id))
      .orderBy(asc(instructorAvailabilities.weekday), asc(instructorAvailabilities.startTime)),
    db
      .select()
      .from(instructorUnavailabilities)
      .where(eq(instructorUnavailabilities.instructorId, id))
      .orderBy(asc(instructorUnavailabilities.startsAt)),
  ]);
  return { ...instructor, availabilities, unavailabilities };
}

export interface InstructorDefaults {
  color: string;
  initials: string;
}

/**
 * Couleur et initiales proposées pour un nouveau moniteur : première couleur
 * non utilisée dans la saison, initiales différentes de celles déjà prises.
 */
export async function getInstructorDefaults(
  db: Db,
  seasonId: string,
  names: { firstName: string; lastName: string } = { firstName: "", lastName: "" },
  excludeId?: string,
): Promise<InstructorDefaults> {
  const others = (
    await db
      .select({ id: instructors.id, color: instructors.color, initials: instructors.initials })
      .from(instructors)
      .where(eq(instructors.seasonId, seasonId))
  ).filter((i) => i.id !== excludeId);
  return {
    color: pickInstructorColor(others.map((i) => i.color)),
    initials: suggestInitials(
      names.firstName,
      names.lastName,
      others.map((i) => i.initials),
    ),
  };
}

export type NewInstructorInput = Omit<InstructorInput, "color" | "initials"> &
  Partial<Pick<InstructorInput, "color" | "initials">>;

/** Crée un moniteur ; couleur et initiales sont attribuées automatiquement si absentes. */
export async function createInstructor(
  db: Db,
  seasonId: string,
  input: NewInstructorInput,
): Promise<string> {
  const defaults = await getInstructorDefaults(db, seasonId, input);
  const id = crypto.randomUUID();
  await db.insert(instructors).values({
    id,
    seasonId,
    ...input,
    color: input.color ?? defaults.color,
    initials: input.initials || defaults.initials || "?",
  });
  return id;
}

export async function updateInstructor(db: Db, id: string, input: InstructorInput): Promise<void> {
  await db.update(instructors).set(input).where(eq(instructors.id, id));
}

/** Remplace toutes les plages hebdomadaires d'un moniteur (une seule transaction). */
export async function replaceAvailabilities(
  db: Db,
  instructorId: string,
  slots: readonly WeeklySlot[],
): Promise<void> {
  const normalized = normalizeSlots(slots);
  await db.batch([
    db
      .delete(instructorAvailabilities)
      .where(eq(instructorAvailabilities.instructorId, instructorId)),
    ...normalized.map((slot) =>
      db.insert(instructorAvailabilities).values({ instructorId, ...slot }),
    ),
  ]);
}

export type UnavailabilityInput = UnavailabilityRange & { reason: string | null };

export async function addUnavailability(
  db: Db,
  instructorId: string,
  input: UnavailabilityInput,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(instructorUnavailabilities).values({ id, instructorId, ...input });
  return id;
}

export async function updateUnavailability(
  db: Db,
  id: string,
  input: UnavailabilityInput,
): Promise<void> {
  await db
    .update(instructorUnavailabilities)
    .set(input)
    .where(eq(instructorUnavailabilities.id, id));
}

export async function deleteUnavailability(db: Db, id: string): Promise<void> {
  await db.delete(instructorUnavailabilities).where(eq(instructorUnavailabilities.id, id));
}

/** Cours, remplacements et cours ponctuels assurés par ce moniteur. */
export async function getInstructorUsage(db: Db, id: string): Promise<Usage> {
  return usageOf(db, [
    { table: lessons, where: eq(lessons.instructorId, id), singular: "cours", plural: "cours" },
    {
      table: lessonExceptions,
      where: eq(lessonExceptions.instructorId, id),
      singular: "séance d'une semaine précise",
      plural: "séances d'une semaine précise",
    },
  ]);
}

export async function setInstructorActive(db: Db, id: string, active: boolean): Promise<void> {
  await db.update(instructors).set({ active }).where(eq(instructors.id, id));
}

/** Supprime un moniteur avec ses disponibilités et indisponibilités. */
export async function deleteInstructor(db: Db, id: string): Promise<void> {
  await db.delete(instructors).where(eq(instructors.id, id));
}
