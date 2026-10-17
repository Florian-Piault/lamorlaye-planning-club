import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useReadOnly, useViewedSeason } from "@/app/season";
import { useToast } from "@/components/feedback/Toast";
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
  const season = useViewedSeason();
  const readOnly = useReadOnly();
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
  const toast = useToast();

  const instructor = data?.instructor;
  useEffect(() => {
    if (instructor) setSlots(instructor.availabilities);
  }, [instructor]);

  // Plages affichées, lues au moment d'un changement pour pouvoir l'annuler.
  const currentSlots = useRef(slots);
  currentSlots.current = slots;

  /** Enregistre les plages ; renvoie faux (après le toast d'erreur) en cas d'échec. */
  const save = useCallback(
    async (next: WeeklySlot[]) => {
      setSlots(next);
      try {
        await replaceAvailabilities(db, id, next);
        return true;
      } catch (e) {
        toast.error(errorMessage(e));
        return false;
      } finally {
        reload();
      }
    },
    [db, id, reload, toast],
  );

  /**
   * Chaque changement enregistré est annoncé par un toast avec « Annuler »,
   * qui rétablit les plages précédentes (§3.3) ; pas d'historique.
   */
  const undoToast = useRef<number | null>(null);
  const changeSlots = useCallback(
    async (next: WeeklySlot[], message: string) => {
      const previous = currentSlots.current;
      if (!(await save(next))) return;
      undoToast.current = toast.success(message, {
        action: {
          label: "Annuler",
          run: async () => {
            if (await save(previous)) toast.success(`Annulé : ${message}`);
          },
        },
      });
    },
    [save, toast],
  );
  // « Annuler » ne vaut que sur la fiche de ce moniteur : le toast est fermé
  // quand on en sort (autre moniteur ou autre écran).
  // biome-ignore lint/correctness/useExhaustiveDependencies: fermé au changement de moniteur.
  useEffect(
    () => () => {
      if (undoToast.current !== null) toast.dismiss(undoToast.current);
      undoToast.current = null;
    },
    [id, toast],
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
        {!readOnly && (
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
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disponible chaque semaine</CardTitle>
          <CardDescription>Horaires de disponibilité, valables toute la saison.</CardDescription>
        </CardHeader>
        <CardContent>
          <AvailabilityEditor
            slots={slots}
            days={season.displayedDays}
            dayStart={season.displayStartTime}
            dayEnd={season.displayEndTime}
            color={instructor.color}
            onChange={changeSlots}
            readOnly={readOnly}
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
              readOnly={readOnly}
              onSubmit={async (input) => {
                await updateInstructor(db, id, input);
                await reload();
                toast.success("Modifications enregistrées.");
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
              readOnly={readOnly}
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
