import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { useSeason } from "@/app/season";
import { useToast } from "@/components/feedback/Toast";
import { onDataChange } from "@/db/changes";
import { useDatabase } from "@/db/DatabaseProvider";
import { countSeasonContents } from "@/db/repositories/seasons";
import {
  crossedStep,
  type Guidance,
  type GuidanceStepKey,
  guidanceOf,
  nextStepLabel,
  type SeasonCounts,
  sameGuidance,
  stepDoneMessage,
} from "@/domain/guidance";

/** Écran de chaque étape. */
export const STEP_PATHS: Record<GuidanceStepKey, string> = {
  saison: "/referentiels/saison",
  courts: "/referentiels/courts",
  moniteurs: "/referentiels/moniteurs",
  groupes: "/referentiels/groupes",
  eleves: "/referentiels/eleves",
  planning: "/planning",
};

/**
 * Guidage affiché : `loading` le temps de la première lecture, `off` une fois
 * le guidage complet ou sur une saison terminée (consultation seulement).
 */
export type GuidanceState =
  | { status: "loading" }
  | { status: "off" }
  | { status: "on"; guidance: Guidance };

const GuidanceContext = createContext<GuidanceState>({ status: "off" });

/** Regroupe les écritures rapprochées (import, données de test) en une seule relecture. */
const SETTLE_DELAY = 150;

/**
 * Suit l'état des étapes du guidage de la saison consultée : relu à chaque
 * changement de saison et après chaque écriture en base, quel que soit
 * l'écran qui écrit. La première fois qu'une étape est franchie, le toast de
 * confirmation de l'écran reçoit l'action « Étape suivante » (ou un toast est
 * affiché s'il n'y en a pas).
 */
export function GuidanceProvider({ children }: { children: ReactNode }) {
  const { db } = useDatabase();
  const { season, readOnly, loading } = useSeason();
  const toast = useToast();
  const navigate = useNavigate();
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  /** Saison dont les comptes n'ont pu être lus avant tout état connu : guidage éteint. */
  const [failedSeason, setFailedSeason] = useState<string | null>(null);
  const seasonId = season?.id ?? null;

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    let reads = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      const ticket = ++reads;
      let counts: SeasonCounts | null = null;
      let failed = false;
      if (seasonId) {
        try {
          counts = await countSeasonContents(db, seasonId);
        } catch {
          failed = true;
        }
      }
      // Seule la dernière lecture compte (les lectures peuvent se croiser).
      if (cancelled || ticket !== reads) return;
      // Lecture impossible : l'état précédent est gardé ; sans état connu,
      // le guidage s'éteint plutôt que de remplacer le planning par l'accueil.
      if (failed) {
        setFailedSeason(seasonId);
        return;
      }
      setFailedSeason(null);
      const next = guidanceOf(seasonId, counts);
      setGuidance((previous) => (sameGuidance(previous, next) ? previous : next));
    };
    read();
    const unsubscribe = onDataChange(() => {
      clearTimeout(timer);
      timer = setTimeout(read, SETTLE_DELAY);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [db, seasonId, loading]);

  // Toast de première fois : comparaison avec l'état précédent.
  const previous = useRef<Guidance | null>(null);
  useEffect(() => {
    if (!guidance) return;
    const before = previous.current;
    previous.current = guidance;
    const step = crossedStep(before, guidance);
    if (!step || readOnly) return;
    const next = guidance.next;
    if (!next) return;
    toast.suggest(stepDoneMessage(step), {
      label: nextStepLabel(next),
      run: () => navigate(STEP_PATHS[next]),
    });
  }, [guidance, readOnly, toast, navigate]);

  // Valeur stable : les écrans (planning) ne sont redessinés que si le guidage change.
  const state = useMemo<GuidanceState>(() => {
    if (loading) return { status: "loading" };
    if (!guidance || guidance.seasonId !== seasonId) {
      return seasonId !== null && failedSeason === seasonId
        ? { status: "off" }
        : { status: "loading" };
    }
    return readOnly || guidance.complete ? { status: "off" } : { status: "on", guidance };
  }, [loading, guidance, seasonId, readOnly, failedSeason]);

  return <GuidanceContext.Provider value={state}>{children}</GuidanceContext.Provider>;
}

/** Guidage de la saison consultée. */
export function useGuidance(): GuidanceState {
  return useContext(GuidanceContext);
}
