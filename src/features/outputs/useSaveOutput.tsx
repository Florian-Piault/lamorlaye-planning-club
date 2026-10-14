import { ExternalLink } from "lucide-react";
import { useCallback, useState } from "react";
import { ErrorAlert } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/hooks/useLoader";
import { type OutputFile, openLastOutput, type SavedOutput, saveOutput } from "./save";

export interface SaveState {
  busy: boolean;
  saved: SavedOutput | null;
  error: string | null;
}

const idle: SaveState = { busy: false, saved: null, error: null };

/** Enregistrement d'un document (dialogue « Enregistrer » ou téléchargement), avec son état. */
export function useSaveOutput() {
  const [state, setState] = useState<SaveState>(idle);

  const save = useCallback(async (file: OutputFile | (() => Promise<OutputFile>)) => {
    setState({ busy: true, saved: null, error: null });
    try {
      const saved = await saveOutput(typeof file === "function" ? await file() : file);
      setState({ busy: false, saved, error: null });
      return saved;
    } catch (e) {
      setState({ busy: false, saved: null, error: errorMessage(e) });
      return null;
    }
  }, []);

  const open = useCallback(async () => {
    try {
      await openLastOutput();
    } catch (e) {
      setState((s) => ({ ...s, error: errorMessage(e) }));
    }
  }, []);

  const reset = useCallback(() => setState(idle), []);

  return { state, save, open, reset };
}

/** Résultat du dernier enregistrement : nom du fichier, bouton « Ouvrir », ou erreur. */
export function SaveStatus({ state, onOpen }: { state: SaveState; onOpen: () => void }) {
  if (state.error) return <ErrorAlert>{state.error}</ErrorAlert>;
  if (!state.saved) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <output data-testid="output-saved">
        {state.saved.canOpen
          ? `Enregistré : ${state.saved.name}`
          : `Téléchargé : ${state.saved.name}`}
      </output>
      {state.saved.canOpen && (
        <Button size="sm" variant="outline" onClick={onOpen}>
          <ExternalLink aria-hidden />
          Ouvrir
        </Button>
      )}
    </div>
  );
}
