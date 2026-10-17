import { useCallback, useMemo, useState } from "react";
import { useSeason } from "@/app/season";
import { SearchInput } from "@/components/data/ListControls";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TechnicalDetails } from "@/components/ui/technical-details";
import { useDatabase } from "@/db/DatabaseProvider";
import { listPeople } from "@/db/repositories/rgpd";
import { matchesSearch } from "@/domain/search";
import { formatDate } from "@/domain/time";
import { useLoader } from "@/hooks/useLoader";
import { StudentPrivacyDialog } from "./StudentPrivacyDialog";

const MAX_RESULTS = 10;

/**
 * Données personnelles (RGPD, §11.6), toutes saisons confondues : recherche
 * d'une personne, export de ses données et suppression définitive. C'est le
 * seul moyen d'effacer un ancien élève qui ne figure plus que dans des
 * saisons archivées (le droit à l'effacement prime sur la lecture seule).
 */
export function PrivacyCard() {
  const { db } = useDatabase();
  const { reload: reloadSeasons } = useSeason();
  const load = useCallback(() => listPeople(db), [db]);
  const { data, reload } = useLoader(load);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const toast = useToast();

  const results = useMemo(
    () =>
      query.trim().length < 2
        ? []
        : (data ?? []).filter((p) => matchesSearch([p.lastName, p.firstName], query)),
    [data, query],
  );

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Données personnelles (RGPD)</CardTitle>
        <CardDescription>
          Les données des élèves, dont des mineurs, restent sur cet ordinateur. Recherchez un élève,
          toutes saisons confondues, pour exporter ses données ou les supprimer définitivement.
          Protégez l'ordinateur par un mot de passe, et les sauvegardes exportées aussi.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TechnicalDetails>
          <p>
            Pour protéger les données même en cas de vol, chiffrez le disque de l'ordinateur :
            FileVault sous macOS, BitLocker sous Windows, LUKS sous Linux.
          </p>
        </TechnicalDetails>
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Rechercher un élève (toutes saisons)"
          className="max-w-md"
        />
        {query.trim().length >= 2 && (
          <ul aria-label="Élèves trouvés" className="divide-y rounded-lg border text-sm">
            {results.length === 0 && (
              <li className="px-3 py-2 text-muted-foreground">Aucun élève trouvé.</li>
            )}
            {results.slice(0, MAX_RESULTS).map((person) => {
              const name = `${person.lastName} ${person.firstName}`;
              return (
                <li key={person.key} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="flex-1">
                    <span className="font-medium">{name}</span>
                    {person.birthDate && (
                      <span className="text-muted-foreground">
                        {" "}
                        — {formatDate(person.birthDate)}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {" "}
                      — {person.records.map((r) => r.seasonName).join(", ")}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Données personnelles de ${name}`}
                    onClick={() => setSelected(person.records[0]?.studentId ?? null)}
                  >
                    Données personnelles…
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <StudentPrivacyDialog
        studentId={selected}
        allowErase
        onClose={() => setSelected(null)}
        onErased={(count) => {
          setSelected(null);
          toast.success(
            `Données supprimées définitivement (${count} ${count > 1 ? "fiches" : "fiche"}).`,
          );
          reload();
          reloadSeasons();
        }}
      />
    </Card>
  );
}
