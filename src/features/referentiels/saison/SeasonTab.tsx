import { Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useSeason } from "@/app/season";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDatabase } from "@/db/DatabaseProvider";
import { createSeason, listSeasons, updateSeason } from "@/db/repositories/seasons";
import { formatDate } from "@/domain/time";
import { useLoader } from "@/hooks/useLoader";
import { defaultSeasonValues, SeasonForm, seasonValues } from "./SeasonForm";

export function SeasonTab() {
  const { db } = useDatabase();
  const { season, loading, reload: reloadSeason } = useSeason();
  const loadSeasons = useCallback(() => listSeasons(db), [db]);
  const seasons = useLoader(loadSeasons);
  const [creating, setCreating] = useState(false);

  const reload = () => {
    reloadSeason();
    seasons.reload();
  };

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
              reload();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
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

      <section className="flex max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Toutes les saisons</h2>
          <Button variant="outline" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Nouvelle saison
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(seasons.data ?? []).map((s) => (
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="Nouvelle saison"
        description={`La saison « ${season.name} » sera archivée : une seule saison est active à la fois.`}
        className="max-w-2xl"
      >
        <SeasonForm
          initialValues={{ ...defaultSeasonValues(), name: "" }}
          submitLabel="Créer la saison"
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            await createSeason(db, input);
            setCreating(false);
            reload();
          }}
        />
      </Dialog>
    </div>
  );
}
