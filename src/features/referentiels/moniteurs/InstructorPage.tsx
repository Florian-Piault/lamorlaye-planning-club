import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useActiveSeason } from "@/app/season";
import { ErrorAlert } from "@/components/form/Field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDatabase } from "@/db/DatabaseProvider";
import {
  addUnavailability,
  deleteInstructor,
  deleteUnavailability,
  getInstructor,
  getInstructorUsage,
  listInstructors,
  replaceAvailabilities,
  setInstructorActive,
  updateInstructor,
  updateUnavailability,
} from "@/db/repositories/instructors";
import type { WeeklySlot } from "@/domain/availability";
import { errorMessage, useLoader } from "@/hooks/useLoader";
import { DeleteAction } from "../components/DeleteAction";
import { StatusBadge } from "../components/StatusBadge";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { InstructorForm, instructorValues } from "./InstructorForm";
import { UnavailabilitySection } from "./UnavailabilitySection";

/** Fiche d'un moniteur : identité, couleur, disponibilités et indisponibilités. */
export function InstructorPage() {
  const { id = "" } = useParams();
  const { db } = useDatabase();
  const season = useActiveSeason();
  const navigate = useNavigate();
  const load = useCallback(async () => {
    const [instructor, all] = await Promise.all([
      getInstructor(db, id),
      listInstructors(db, season.id),
    ]);
    return { instructor, others: all.filter((i) => i.id !== id) };
  }, [db, id, season.id]);
  const { data, loading, reload } = useLoader(load);
  const [slots, setSlots] = useState<WeeklySlot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const instructor = data?.instructor;
  useEffect(() => {
    if (instructor) setSlots(instructor.availabilities);
  }, [instructor]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setError(null);
      try {
        await action();
      } catch (e) {
        setError(errorMessage(e));
      }
      reload();
    },
    [reload],
  );

  const changeSlots = useCallback(
    (next: WeeklySlot[]) => {
      setSlots(next);
      run(() => replaceAvailabilities(db, id, next));
    },
    [db, id, run],
  );

  if (!instructor) {
    return loading ? (
      <p className="text-muted-foreground text-sm">Chargement…</p>
    ) : (
      <p className="text-sm">
        Moniteur introuvable.{" "}
        <Link to="/referentiels/moniteurs" className="underline">
          Retour à la liste
        </Link>
      </p>
    );
  }

  const name = `${instructor.firstName} ${instructor.lastName}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          to="/referentiels/moniteurs"
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Moniteurs
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="rounded px-2 py-1 font-semibold text-sm text-white"
          style={{ backgroundColor: instructor.color }}
        >
          {instructor.initials}
        </span>
        <h2 className="font-semibold text-lg">{name}</h2>
        <StatusBadge active={instructor.active} />
        <div className="ml-auto">
          <DeleteAction
            showLabel
            name={name}
            subject={`le moniteur « ${name} »`}
            archived={!instructor.active}
            getUsage={() => getInstructorUsage(db, id)}
            onDelete={async () => {
              await deleteInstructor(db, id);
              navigate("/referentiels/moniteurs");
            }}
            onArchive={() => setInstructorActive(db, id, false)}
            onDone={reload}
          />
        </div>
      </div>
      <ErrorAlert>{error}</ErrorAlert>

      <Card>
        <CardHeader>
          <CardTitle>Disponibilités hebdomadaires</CardTitle>
          <CardDescription>Plages récurrentes, valables toute la saison.</CardDescription>
        </CardHeader>
        <CardContent>
          <AvailabilityEditor
            slots={slots}
            days={season.displayedDays}
            dayStart={season.displayStartTime}
            dayEnd={season.displayEndTime}
            color={instructor.color}
            onChange={changeSlots}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fiche</CardTitle>
          </CardHeader>
          <CardContent>
            <InstructorForm
              key={instructor.id}
              initialValues={instructorValues(instructor)}
              others={data.others}
              submitLabel="Enregistrer"
              onSubmit={async (input) => {
                await updateInstructor(db, id, input);
                reload();
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Indisponibilités</CardTitle>
            <CardDescription>Absences ponctuelles : congé, maladie, tournoi…</CardDescription>
          </CardHeader>
          <CardContent>
            <UnavailabilitySection
              unavailabilities={instructor.unavailabilities}
              onAdd={async (input) => {
                await addUnavailability(db, id, input);
                reload();
              }}
              onUpdate={async (unavailabilityId, input) => {
                await updateUnavailability(db, unavailabilityId, input);
                reload();
              }}
              onDelete={async (unavailabilityId) => {
                await deleteUnavailability(db, unavailabilityId);
                reload();
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
