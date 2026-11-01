import type { Db } from "@/db";
import { createCourt } from "@/db/repositories/courts";
import { createGroup } from "@/db/repositories/groups";
import {
  addUnavailability,
  createInstructor,
  replaceAvailabilities,
} from "@/db/repositories/instructors";
import { createSeason } from "@/db/repositories/seasons";
import { createStudent, replaceStudentAvailabilities } from "@/db/repositories/students";
import { closures, lessonExceptions, lessons } from "@/db/schema";

/** Crée la saison 2026-2027 (active). */
export async function seedSeason(db: Db, name = "2026-2027") {
  return createSeason(db, {
    name,
    startDate: "2026-09-01",
    endDate: "2027-06-30",
    displayStartTime: "08:00",
    displayEndTime: "22:00",
    displayedDays: [1, 2, 3, 4, 5, 6, 7],
  });
}

/**
 * Saison 2026-2027 complète : 2 courts, 2 moniteurs (plages et une
 * indisponibilité), 2 groupes, 3 élèves (dont un dans les deux groupes ; Léa
 * a des plages de disponibilité, les autres aucune), et
 * une semaine type avec :
 * - `current` : cours en vigueur toute la saison ;
 * - `closed` / `next` : un cours modifié « à partir du 04/01/2027 » (deux versions) ;
 * - `stopped` : un cours arrêté le 31/01/2027 ;
 * plus une exception, un cours ponctuel et une fermeture.
 */
export async function seedFullSeason(db: Db, seasonId: string) {
  const court1 = await createCourt(db, seasonId, { name: "Court 1", kind: "indoor", active: true });
  const court2 = await createCourt(db, seasonId, {
    name: "Court 2",
    kind: "outdoor",
    active: false,
  });
  const person = (firstName: string, lastName: string, color: string) => ({
    firstName,
    lastName,
    phone: "0600000000",
    email: null,
    color,
    initials: `${firstName[0]}${lastName[0]}`,
    active: true,
  });
  const julie = await createInstructor(db, seasonId, person("Julie", "Martin", "#1D4ED8"));
  const karim = await createInstructor(db, seasonId, person("Karim", "Benali", "#C2410C"));
  await replaceAvailabilities(db, julie, [
    { weekday: 1, startTime: "16:00", endTime: "21:00" },
    { weekday: 3, startTime: "09:00", endTime: "13:00" },
  ]);
  await replaceAvailabilities(db, karim, [{ weekday: 2, startTime: "09:00", endTime: "12:00" }]);
  await addUnavailability(db, julie, {
    startsAt: "2026-11-02T00:00",
    endsAt: "2026-11-07T00:00",
    reason: "Congé",
  });
  const group = (name: string) => ({
    name,
    levelId: null,
    minAge: 6,
    maxAge: 10,
    maxSize: 8,
    active: true,
  });
  const galaxie = await createGroup(db, seasonId, group("Galaxie vert"));
  const ados = await createGroup(db, seasonId, group("Ados"));
  const student = (firstName: string, birthDate: string | null) => ({
    lastName: "Dupont",
    firstName,
    phone: "0612345678",
    birthDate,
    levelId: null,
    fftRanking: null,
    email: null,
    guardianName: "Marie Dupont",
    guardianPhone: "0698765432",
  });
  const lea = await createStudent(db, seasonId, student("Léa", "2017-05-04"), [galaxie, ados]);
  const tom = await createStudent(db, seasonId, student("Tom", "2016-01-12"), [galaxie]);
  const zoe = await createStudent(db, seasonId, student("Zoé", null), []);
  await replaceStudentAvailabilities(db, lea, [
    { weekday: 3, startTime: "14:00", endTime: "18:00" },
    { weekday: 6, startTime: "09:00", endTime: "12:00" },
  ]);

  const lesson = (
    id: string,
    values: {
      weekday: number;
      groupId: string;
      from: string;
      to: string | null;
      previous?: string;
    },
  ) => ({
    id,
    seasonId,
    weekday: values.weekday,
    startTime: "17:00",
    durationMinutes: 60,
    courtId: court1,
    groupId: values.groupId,
    instructorId: julie,
    effectiveFrom: values.from,
    effectiveTo: values.to,
    previousLessonId: values.previous ?? null,
    note: "Raquettes fournies",
  });
  const ids = {
    current: crypto.randomUUID(),
    closed: crypto.randomUUID(),
    next: crypto.randomUUID(),
    stopped: crypto.randomUUID(),
  };
  await db.insert(lessons).values([
    lesson(ids.current, { weekday: 1, groupId: galaxie, from: "2026-09-01", to: null }),
    lesson(ids.closed, { weekday: 3, groupId: ados, from: "2026-09-01", to: "2027-01-03" }),
    lesson(ids.next, {
      weekday: 4,
      groupId: ados,
      from: "2027-01-04",
      to: null,
      previous: ids.closed,
    }),
    lesson(ids.stopped, { weekday: 5, groupId: galaxie, from: "2026-09-01", to: "2027-01-31" }),
  ]);
  await db.insert(lessonExceptions).values([
    {
      id: crypto.randomUUID(),
      seasonId,
      kind: "cancellation",
      lessonId: ids.current,
      occurrenceDate: "2026-09-07",
      cancellationReason: "rain",
    },
    {
      id: crypto.randomUUID(),
      seasonId,
      kind: "one_off",
      date: "2026-10-21",
      startTime: "10:00",
      durationMinutes: 120,
      courtId: court2,
      instructorId: karim,
      groupId: null,
    },
  ]);
  await db.insert(closures).values({
    id: crypto.randomUUID(),
    seasonId,
    label: "Vacances de Noël",
    startDate: "2026-12-19",
    endDate: "2027-01-03",
  });
  return {
    courts: { court1, court2 },
    instructors: { julie, karim },
    groups: { galaxie, ados },
    students: { lea, tom, zoe },
    lessons: ids,
  };
}

/** Insère un cours de semaine type (pour tester l'utilisation des référentiels). */
export async function seedLesson(
  db: Db,
  refs: { seasonId: string; courtId: string; groupId: string; instructorId: string },
) {
  const id = crypto.randomUUID();
  await db.insert(lessons).values({
    id,
    ...refs,
    weekday: 3,
    startTime: "14:00",
    durationMinutes: 60,
    effectiveFrom: "2026-09-01",
  });
  return id;
}
