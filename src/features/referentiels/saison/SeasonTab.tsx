import { Copy, Eye, Plus } from "lucide-react";
import { useState } from "react";
import { useSeason } from "@/app/season";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDatabase } from "@/db/DatabaseProvider";
import { createSeason, duplicateSeason, updateSeason } from "@/db/repositories/seasons";
import type { Season } from "@/db/schema";
import { type DuplicationSummary, nextSeasonValues } from "@/domain/seasonDuplication";
import { formatDate, WEEKDAYS } from "@/domain/time";
import { defaultSeasonValues, SeasonForm, seasonValues } from "./SeasonForm";

export function SeasonTab() {
  const { db } = useDatabase();
  const { season, activeSeason, seasons, readOnly, loading, reload, selectSeason } = useSeason();
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <p className="text-muted-foreground text-sm">Chargement…</p>;

  if (!season) {
    return (
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Créer la saison</CardTitle>
          <CardDescription>
            La saison regroupe les courts, moniteurs, groupes, élèves et la semaine type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeasonForm
            initialValues={defaultSeasonValues()}
            submitLabel="Créer la saison"
            onSubmit={async (input) => {
              await createSeason(db, input);
              selectSeason(null);
              reload();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {readOnly ? (
        <ArchivedSeasonCard season={season} />
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Saison active</CardTitle>
            <CardDescription>Amplitude horaire et jours affichés dans le planning.</CardDescription>
          </CardHeader>
          <CardContent>
            <SeasonForm
              key={season.id}
              initialValues={seasonValues(season)}
              submitLabel="Enregistrer"
              onSubmit={async (input) => {
                await updateSeason(db, season.id, input);
                reload();
              }}
            />
          </CardContent>
        </Card>
      )}

      <section className="flex max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Toutes les saisons</h2>
          {!readOnly && (
            <Button variant="outline" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              Nouvelle saison
            </Button>
          )}
        </div>
        {message && (
          <output className="text-muted-foreground text-sm" data-testid="season-message">
            {message}
          </output>
        )}
        <Table aria-label="Saisons">
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-32">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seasons.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{formatDate(s.startDate)}</TableCell>
                <TableCell>{formatDate(s.endDate)}</TableCell>
                <TableCell>
                  {s.status === "active" ? (
                    <Badge>Active</Badge>
                  ) : (
                    <Badge variant="outline">Archivée</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {s.id === season.id ? (
                    <span className="text-muted-foreground text-xs">Consultée</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Consulter la saison ${s.name}`}
                      onClick={() => selectSeason(s.status === "active" ? null : s.id)}
                    >
                      <Eye aria-hidden />
                      Consulter
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {!readOnly && (
        <NewSeasonDialog
          open={creating}
          onOpenChange={setCreating}
          source={activeSeason}
          onCreated={(summary) => {
            setCreating(false);
            selectSeason(null);
            reload();
            setMessage(summary ? describeSummary(summary) : "Saison créée.");
          }}
          create={async (input, sourceId) => {
            if (sourceId) return (await duplicateSeason(db, sourceId, input)).summary;
            await createSeason(db, input);
            return null;
          }}
        />
      )}
    </div>
  );
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`;

function describeSummary(summary: DuplicationSummary): string {
  const parts = [
    plural(summary.courts, "court"),
    plural(summary.instructors, "moniteur"),
    plural(summary.groups, "groupe"),
    plural(summary.students, "élève"),
    plural(summary.lessons, "cours", "cours"),
  ];
  return `Saison créée par duplication : ${parts.join(", ")} repris.`;
}

/** Saison archivée : consultation seule de ses réglages. */
function ArchivedSeasonCard({ season }: { season: Season }) {
  const days = WEEKDAYS.filter((d) => season.displayedDays.includes(d.value))
    .map((d) => d.label.toLowerCase())
    .join(", ");
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          Saison {season.name}
          <Badge variant="outline">Archivée</Badge>
        </CardTitle>
        <CardDescription>
          Saison passée, consultable en lecture seule : ses référentiels, son planning et ses
          fermetures ne peuvent plus être modifiés.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Période</dt>
          <dd>
            du {formatDate(season.startDate)} au {formatDate(season.endDate)}
          </dd>
          <dt className="text-muted-foreground">Amplitude horaire</dt>
          <dd>
            {season.displayStartTime} – {season.displayEndTime}
          </dd>
          <dt className="text-muted-foreground">Jours affichés</dt>
          <dd>{days}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

interface NewSeasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saison proposée à la duplication (la saison active). */
  source: Season | null;
  create: (
    input: Parameters<typeof createSeason>[1],
    sourceId: string | null,
  ) => Promise<DuplicationSummary | null>;
  onCreated: (summary: DuplicationSummary | null) => void;
}

/** Nouvelle saison (§8.1) : vierge, ou par duplication de la saison active. */
function NewSeasonDialog({ open, onOpenChange, source, create, onCreated }: NewSeasonDialogProps) {
  const [mode, setMode] = useState<"duplicate" | "blank">(source ? "duplicate" : "blank");
  const initialValues = source ? nextSeasonValues(source) : { ...defaultSeasonValues(), name: "" };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nouvelle saison"
      description={
        source
          ? `La saison « ${source.name} » sera archivée : elle restera consultable en lecture seule. Une seule saison est active à la fois.`
          : undefined
      }
      className="max-w-2xl"
    >
      {open && (
        <div className="flex flex-col gap-4">
          {source && (
            <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
              <legend className="px-1 font-medium text-sm">Contenu</legend>
              <Label className="items-start font-normal">
                <input
                  type="radio"
                  name="new-season-mode"
                  className="mt-1"
                  checked={mode === "duplicate"}
                  onChange={() => setMode("duplicate")}
                />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Copy className="size-3.5" aria-hidden />
                    Dupliquer la saison {source.name}
                  </span>
                  <span className="block text-muted-foreground text-xs">
                    Copie des courts, des moniteurs et de leurs disponibilités hebdomadaires, des
                    groupes et de leur composition, des élèves et de la semaine type (cours en
                    vigueur en fin de saison). Les exceptions, indisponibilités datées et fermetures
                    ne sont pas copiées.
                  </span>
                </span>
              </Label>
              <Label className="font-normal">
                <input
                  type="radio"
                  name="new-season-mode"
                  checked={mode === "blank"}
                  onChange={() => setMode("blank")}
                />
                Saison vierge
              </Label>
            </fieldset>
          )}
          <SeasonForm
            initialValues={initialValues}
            submitLabel={mode === "duplicate" ? "Dupliquer la saison" : "Créer la saison"}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (input) => {
              const summary = await create(
                input,
                mode === "duplicate" ? (source?.id ?? null) : null,
              );
              onCreated(summary);
            }}
          />
        </div>
      )}
    </Dialog>
  );
}
