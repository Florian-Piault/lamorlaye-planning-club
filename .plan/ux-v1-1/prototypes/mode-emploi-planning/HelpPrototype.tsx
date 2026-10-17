/**
 * PROTOTYPE jetable — ticket « Mode d'emploi du planning »
 * (.plan/ux-v1-1/issues/10-mode-emploi-planning.md).
 *
 * Trois variantes du mode d'emploi, montées dans la vraie page Planning,
 * commutables par la barre rose en bas (ou Alt+←/→, ou `?variant=A|B|C`) :
 *   A. Section repliable en tête du panneau latéral (repli mémorisé)
 *   B. Bouton « Aide » dans la barre d'outils, feuille d'aide à part
 *   C. Astuce selon le contexte, liste complète sur demande
 * Commun : texte qui part de « + Nouveau cours », section « Pour aller plus
 * vite », raccourcis selon le système, ouvert d'office tant qu'aucun cours
 * n'est placé (fin du guidage de première utilisation, ticket 08).
 *
 * La barre propose « Données de démo » (base en mémoire en navigateur) et
 * « Simuler : aucun cours ». À retirer une fois la variante choisie.
 */
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Lightbulb,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { useSeason } from "@/app/season";
import { Button } from "@/components/ui/button";
import { useDatabase } from "@/db/DatabaseProvider";
import { cn } from "@/lib/utils";
import { seedFullSeason, seedSeason } from "@/test/fixtures";
import { type WarningItem, WarningsPanel } from "../planning/components/WarningsPanel";

// --- État du prototype (mémoire + localStorage) ----------------------------

type Variant = "A" | "B" | "C";
const VARIANTS: readonly Variant[] = ["A", "B", "C"];
const NAMES: Record<Variant, string> = {
  A: "Section repliable du panneau",
  B: "Bouton Aide + feuille",
  C: "Astuce selon le contexte",
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function initialVariant(): Variant {
  const fromUrl = new URLSearchParams(window.location.hash.split("?")[1] ?? window.location.search)
    .get("variant")
    ?.toUpperCase();
  const v = fromUrl ?? read("proto-help-variant") ?? "A";
  return (VARIANTS as readonly string[]).includes(v) ? (v as Variant) : "A";
}

interface ProtoState {
  variant: Variant;
  /** Simule un planning sans aucun cours (guidage pas encore terminé). */
  noLessons: boolean;
  /** Repli choisi par l'utilisatrice ; `null` = jamais touché (défaut). */
  folded: boolean | null;
  sheetOpen: boolean;
}
let state: ProtoState = {
  variant: initialVariant(),
  noLessons: false,
  folded: read("proto-help-folded") === null ? null : read("proto-help-folded") === "1",
  sheetOpen: false,
};
const listeners = new Set<() => void>();
function set(patch: Partial<ProtoState>) {
  state = { ...state, ...patch };
  write("proto-help-variant", state.variant);
  if (state.folded !== null) write("proto-help-folded", state.folded ? "1" : "0");
  for (const l of listeners) l();
}
function useProto() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
const MOD = isMac ? "⌘" : "Ctrl";
const ALT = isMac ? "⌥ Option" : "Alt";
const DEL = isMac ? "⌫" : "Suppr";

// --- Contenu commun -------------------------------------------------------

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-b-2 px-1 font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  );
}

function Basics() {
  return (
    <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-muted-foreground text-xs">
      <li>
        Cliquez <b className="text-foreground">+ Nouveau cours</b> en haut : choisissez le jour,
        l'heure, le court, le groupe et le moniteur, puis{" "}
        <b className="text-foreground">Enregistrer</b>.
      </li>
      <li>
        Cliquez un cours de la grille pour le <b className="text-foreground">modifier</b> ou le{" "}
        <b className="text-foreground">supprimer</b>.
      </li>
      <li>
        En <b className="text-foreground">Planning habituel</b>, vos changements valent pour toutes
        les semaines de la saison. Pour annuler ou changer un cours une seule fois (vacances,
        tournoi), passez à <b className="text-foreground">Une semaine précise</b>.
      </li>
      <li>
        Une erreur ? Le bouton <b className="text-foreground">Annuler</b> en haut revient en
        arrière.
      </li>
    </ol>
  );
}

const FAST: readonly [ReactNode, ReactNode][] = [
  [<>Glisser dans la colonne d'un court</>, "crée un cours à cet endroit"],
  [<>Glisser un cours</>, "le déplace (jour, heure, court, par 15 min)"],
  [<>Tirer le bas d'un cours</>, "change sa durée"],
  [
    <>
      <Kbd>{ALT}</Kbd> + glisser
    </>,
    "duplique le cours",
  ],
  [<>Glisser la pastille d'un moniteur sur un cours</>, "change de moniteur"],
  [<>Survoler un cours</>, "montre en rayures quand son moniteur n'est pas disponible"],
  [
    <>
      <Kbd>{MOD} N</Kbd>
    </>,
    "nouveau cours",
  ],
  [<Kbd key="d">{DEL}</Kbd>, "supprime le cours sélectionné"],
  [
    <>
      <Kbd>{MOD} Z</Kbd> / <Kbd>{MOD} ⇧ Z</Kbd>
    </>,
    "annule / rétablit",
  ],
  [<Kbd key="e">Échap</Kbd>, "annule le déplacement en cours"],
  [
    <>
      <Kbd>←</Kbd> <Kbd>→</Kbd>
    </>,
    "semaine précédente / suivante (une semaine précise)",
  ],
];

function Faster({ dense = false }: { dense?: boolean }) {
  return (
    <ul className={cn("flex list-disc flex-col pl-4 text-xs", dense ? "gap-1" : "gap-1.5")}>
      {FAST.map(([k, v], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: prototype
        <li key={i} className="text-muted-foreground">
          <span className="font-medium text-foreground">{k}</span> : {v}
        </li>
      ))}
    </ul>
  );
}

// --- A. Section repliable en tête du panneau ------------------------------

function VariantA({ hasLessons }: { hasLessons: boolean }) {
  const { folded } = useProto();
  // Défaut : ouvert tant qu'aucun cours n'est placé, replié ensuite ; le choix
  // de l'utilisatrice est ensuite mémorisé.
  const isFolded = folded ?? hasLessons;
  const [fastOpen, setFastOpen] = useState(false);
  return (
    <section className="flex flex-col gap-2 rounded-md border p-2.5">
      <button
        type="button"
        aria-expanded={!isFolded}
        onClick={() => set({ folded: !isFolded })}
        className="flex items-center justify-between font-semibold text-sm"
      >
        Mode d'emploi
        <ChevronDown aria-hidden className={cn("size-4 transition", isFolded && "-rotate-90")} />
      </button>
      {!isFolded && (
        <>
          <Basics />
          <button
            type="button"
            aria-expanded={fastOpen}
            onClick={() => setFastOpen((o) => !o)}
            className="mt-1 flex items-center gap-1 font-medium text-xs"
          >
            <ChevronDown
              aria-hidden
              className={cn("size-3.5 transition", !fastOpen && "-rotate-90")}
            />
            Pour aller plus vite
          </button>
          {fastOpen && <Faster dense />}
        </>
      )}
    </section>
  );
}

// --- B. Bouton Aide dans la barre d'outils + feuille ----------------------

export function HelpToolbarSlot() {
  const { variant, sheetOpen } = useProto();
  if (variant !== "B") return null;
  return (
    <Button
      size="sm"
      variant={sheetOpen ? "secondary" : "outline"}
      onClick={() => set({ sheetOpen: !sheetOpen })}
      aria-expanded={sheetOpen}
    >
      <CircleHelp aria-hidden />
      Aide
    </Button>
  );
}

function SheetB({ hasLessons }: { hasLessons: boolean }) {
  const { sheetOpen } = useProto();
  // Planning vide : la feuille s'ouvre d'elle-même la première fois.
  useEffect(() => {
    if (!hasLessons && read("proto-help-sheet-seen") !== "1") {
      write("proto-help-sheet-seen", "1");
      set({ sheetOpen: true });
    }
  }, [hasLessons]);
  if (!sheetOpen) return null;
  return (
    <div className="fixed top-28 right-6 z-40 w-[34rem] rounded-lg border bg-card p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-sm">Comment construire le planning</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fermer l'aide"
          onClick={() => set({ sheetOpen: false })}
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <h3 className="mb-2 font-medium text-xs uppercase tracking-wide">Les bases</h3>
          <Basics />
        </div>
        <div>
          <h3 className="mb-2 font-medium text-xs uppercase tracking-wide">Pour aller plus vite</h3>
          <Faster dense />
        </div>
      </div>
    </div>
  );
}

// --- C. Astuce selon le contexte ------------------------------------------

function VariantC({ hasLessons, selected }: { hasLessons: boolean; selected: boolean }) {
  const [all, setAll] = useState(false);
  const tip = !hasLessons ? (
    <>
      Commencez par <b className="text-foreground">+ Nouveau cours</b> en haut : jour, heure, court,
      groupe et moniteur, puis Enregistrer.
    </>
  ) : selected ? (
    <>
      Glissez ce cours pour le déplacer, tirez son bas pour la durée. <Kbd>{DEL}</Kbd> le supprime,{" "}
      <Kbd>{MOD} Z</Kbd> annule.
    </>
  ) : (
    <>
      Cliquez un cours pour le modifier. En <b className="text-foreground">Planning habituel</b>,
      vos changements valent pour toutes les semaines ; pour une seule fois, passez à{" "}
      <b className="text-foreground">Une semaine précise</b>.
    </>
  );
  return (
    <section className="flex flex-col gap-2">
      <div className="flex gap-2 rounded-md bg-primary/10 p-2.5 text-xs">
        <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">{tip}</p>
      </div>
      <button
        type="button"
        aria-expanded={all}
        onClick={() => setAll((o) => !o)}
        className="flex items-center gap-1.5 self-start rounded-md border px-2 py-1 font-medium text-primary text-xs hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BookOpen aria-hidden className="size-3.5" />
        {all ? "Masquer le mode d'emploi" : "Tout le mode d'emploi"}
        <ChevronDown aria-hidden className={cn("size-3.5 transition", all && "rotate-180")} />
      </button>
      {all && (
        <div className="flex flex-col gap-3 rounded-md border p-2.5">
          <Basics />
          <h3 className="font-medium text-xs">Pour aller plus vite</h3>
          <Faster dense />
        </div>
      )}
    </section>
  );
}

// --- Montage dans le panneau latéral --------------------------------------

export function HelpSidePanel({
  items,
  onShow,
  lessonCount,
  selected,
}: {
  items: readonly WarningItem[];
  onShow: (lessonId: string) => void;
  lessonCount: number;
  selected: boolean;
}) {
  const { variant, noLessons } = useProto();
  const hasLessons = lessonCount > 0 && !noLessons;
  return (
    <div className="flex flex-col gap-5">
      {variant === "A" && <VariantA hasLessons={hasLessons} />}
      {variant === "B" && <SheetB hasLessons={hasLessons} />}
      {variant === "C" && <VariantC hasLessons={hasLessons} selected={selected} />}
      <WarningsPanel items={items} onShow={onShow} hideHelp />
    </div>
  );
}

// --- Barre de commutation --------------------------------------------------

export function PrototypeSwitcher() {
  const { variant, noLessons, folded } = useProto();
  const { db } = useDatabase();
  const { reload, activeSeason } = useSeason();
  const [seeding, setSeeding] = useState(false);
  const cycle = (d: number) => {
    const i = VARIANTS.indexOf(variant);
    set({ variant: VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length], sheetOpen: false });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      e.preventDefault();
      e.stopPropagation();
      cycle(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  });
  if (import.meta.env.PROD) return null;
  const seed = async () => {
    setSeeding(true);
    const season = await seedSeason(db);
    await seedFullSeason(db, season.id);
    reload();
    setSeeding(false);
  };
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-pink-600 px-3 py-1.5 text-white text-xs shadow-lg">
      <button type="button" aria-label="Variante précédente" onClick={() => cycle(-1)}>
        <ChevronLeft className="size-4" />
      </button>
      <span className="font-semibold">
        {variant} · {NAMES[variant]}
      </span>
      <button type="button" aria-label="Variante suivante" onClick={() => cycle(1)}>
        <ChevronRight className="size-4" />
      </button>
      <span className="opacity-50">|</span>
      {!activeSeason && (
        <button type="button" onClick={seed} disabled={seeding} className="underline">
          Données de démo
        </button>
      )}
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={noLessons}
          onChange={(e) => set({ noLessons: e.target.checked })}
        />
        Simuler : aucun cours
      </label>
      {variant === "A" && folded !== null && (
        <button
          type="button"
          className="underline"
          onClick={() => {
            try {
              localStorage.removeItem("proto-help-folded");
            } catch {}
            set({ folded: null });
          }}
        >
          Oublier le repli
        </button>
      )}
    </div>
  );
}
