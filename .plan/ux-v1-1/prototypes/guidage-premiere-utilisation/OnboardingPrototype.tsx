/**
 * PROTOTYPE jetable — ticket « Guidage de la première utilisation »
 * (.plan/ux-v1-1/issues/08-guidage-premiere-utilisation.md).
 *
 * Trois variantes du guidage, montées dans la vraie application (coque,
 * Référentiels, Planning), commutables par la barre flottante en bas ou
 * `?variant=A|B|C` dans l'URL :
 *   A. Carte « Bien démarrer » dans la barre latérale
 *   B. Bandeau d'étapes en haut du contenu
 *   C. Guidage fondu dans la navigation (onglets numérotés + accueil du planning)
 * Le toast de confirmation (ticket 06) est commun aux trois.
 *
 * En navigateur (`pnpm dev`) la base est en mémoire : recharger la page = première
 * utilisation. À retirer de l'application une fois la variante choisie.
 */
import { count, eq } from "drizzle-orm";
import { Check, ChevronLeft, ChevronRight, Circle, Compass, Sparkles, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router";
import { useSeason } from "@/app/season";
import { Button } from "@/components/ui/button";
import { useDatabase } from "@/db/DatabaseProvider";
import { courts, groups, instructors, lessons, students } from "@/db/schema";
import { cn } from "@/lib/utils";

// --- Variante courante et état « masqué » (mémoire + sessionStorage) -------

type Variant = "A" | "B" | "C";
const VARIANTS: readonly Variant[] = ["A", "B", "C"];
const NAMES: Record<Variant, string> = {
  A: "Carte dans la barre latérale",
  B: "Bandeau d'étapes",
  C: "Fondu dans la navigation",
};

function initialVariant(): Variant {
  const fromUrl = new URLSearchParams(window.location.hash.split("?")[1] ?? window.location.search)
    .get("variant")
    ?.toUpperCase();
  const stored = sessionStorage.getItem("proto-onboarding-variant");
  const v = fromUrl ?? stored ?? "A";
  return (VARIANTS as readonly string[]).includes(v) ? (v as Variant) : "A";
}

const store = {
  variant: initialVariant(),
  dismissed: false,
  listeners: new Set<() => void>(),
  set(patch: Partial<{ variant: Variant; dismissed: boolean }>) {
    Object.assign(store, patch);
    sessionStorage.setItem("proto-onboarding-variant", store.variant);
    snapshot = { variant: store.variant, dismissed: store.dismissed };
    for (const l of store.listeners) l();
  },
};
let snapshot = { variant: store.variant, dismissed: store.dismissed };
const subscribe = (l: () => void) => {
  store.listeners.add(l);
  return () => store.listeners.delete(l);
};
function useProto() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

// --- Progression, lue dans la vraie base (sondage, c'est un prototype) -----

interface Step {
  key: string;
  label: string;
  /** Libellé de l'appel à l'action quand c'est l'étape suivante. */
  action: string;
  path: string;
  done: boolean;
  /** Message du toast quand l'étape vient d'être franchie. */
  doneMessage: string;
}

function useSteps(): Step[] {
  const { db } = useDatabase();
  const { season } = useSeason();
  const { pathname } = useLocation();
  const [counts, setCounts] = useState({ c: 0, i: 0, g: 0, s: 0, l: 0 });

  // biome-ignore lint/correctness/useExhaustiveDependencies: relu à chaque navigation.
  useEffect(() => {
    if (!season) return setCounts({ c: 0, i: 0, g: 0, s: 0, l: 0 });
    let stop = false;
    const read = async () => {
      const n = async (table: typeof courts | typeof instructors | typeof groups | typeof students | typeof lessons) =>
        (await db.select({ n: count() }).from(table).where(eq(table.seasonId, season.id)))[0]?.n ?? 0;
      const [c, i, g, s, l] = await Promise.all([
        n(courts),
        n(instructors),
        n(groups),
        n(students),
        n(lessons),
      ]);
      if (!stop) setCounts({ c, i, g, s, l });
    };
    read();
    const timer = setInterval(read, 800);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [db, season, pathname]);

  return [
    { key: "saison", label: "Saison", action: "Créer la saison", path: "/referentiels/saison", done: !!season, doneMessage: "Saison créée" },
    { key: "courts", label: "Courts", action: "Ajouter vos courts", path: "/referentiels/courts", done: counts.c > 0, doneMessage: "Premier court ajouté" },
    { key: "moniteurs", label: "Moniteurs", action: "Ajouter vos moniteurs", path: "/referentiels/moniteurs", done: counts.i > 0, doneMessage: "Premier moniteur ajouté" },
    { key: "groupes", label: "Groupes", action: "Créer vos groupes", path: "/referentiels/groupes", done: counts.g > 0, doneMessage: "Premier groupe créé" },
    { key: "eleves", label: "Élèves", action: "Inscrire vos élèves", path: "/referentiels/eleves", done: counts.s > 0, doneMessage: "Premier élève inscrit" },
    { key: "planning", label: "Planning", action: "Placer un premier cours", path: "/planning", done: counts.l > 0, doneMessage: "Premier cours placé" },
  ];
}

const nextStep = (steps: Step[]) => steps.find((s) => !s.done);

// --- Toast commun (ticket 06 : bas-droite, ~4 s, un seul à la fois) --------

function useStepToast(steps: Step[]) {
  const [toast, setToast] = useState<{ text: string; next?: Step } | null>(null);
  const previous = useRef<boolean[] | null>(null);
  const doneFlags = steps.map((s) => s.done);
  // biome-ignore lint/correctness/useExhaustiveDependencies: comparaison des drapeaux.
  useEffect(() => {
    const before = previous.current;
    previous.current = doneFlags;
    if (!before) return;
    const index = doneFlags.findIndex((d, k) => d && !before[k]);
    if (index < 0) return;
    setToast({ text: steps[index]?.doneMessage ?? "", next: nextStep(steps) });
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [doneFlags.join()]);
  return toast;
}

function Toast({ steps }: { steps: Step[] }) {
  const toast = useStepToast(steps);
  if (!toast) return null;
  return (
    <output
      aria-live="polite"
      className="fixed right-5 bottom-5 z-50 flex max-w-sm items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg"
    >
      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
      <div>
        <p className="font-medium">{toast.text}</p>
        {toast.next && (
          <p className="text-muted-foreground">
            Étape suivante :{" "}
            <Link className="underline underline-offset-2" to={toast.next.path}>
              {toast.next.action.toLowerCase()}
            </Link>
          </p>
        )}
      </div>
    </output>
  );
}

// --- Variante A : carte dans la barre latérale -----------------------------

function SidebarCard({ steps }: { steps: Step[] }) {
  const { dismissed } = useProto();
  const done = steps.filter((s) => s.done).length;
  const next = nextStep(steps);
  if (dismissed || !next) return null;
  return (
    <div className="rounded-lg border bg-card p-3 text-xs shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold text-sm">Bien démarrer</p>
        <button
          type="button"
          aria-label="Masquer le guide"
          title="Masquer (rouvrir depuis « Guide de démarrage »)"
          className="rounded p-0.5 text-muted-foreground hover:bg-accent"
          onClick={() => store.set({ dismissed: true })}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="flex flex-col gap-0.5">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              to={s.path}
              className={cn(
                "flex items-center gap-2 rounded px-1.5 py-1 hover:bg-accent",
                s === next && "bg-accent font-medium",
                s.done && "text-muted-foreground line-through",
              )}
            >
              {s.done ? (
                <Check className="size-3.5 text-emerald-600" />
              ) : (
                <Circle className="size-3.5 text-muted-foreground" />
              )}
              {s === next ? s.action : s.label}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReopenLink({ steps }: { steps: Step[] }) {
  const { dismissed } = useProto();
  if (!dismissed || !nextStep(steps)) return null;
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-left font-medium text-sidebar-foreground/75 text-sm hover:bg-sidebar-accent"
      onClick={() => store.set({ dismissed: false })}
    >
      <Compass className="size-4" aria-hidden />
      Guide de démarrage
    </button>
  );
}

// --- Variante B : bandeau d'étapes en haut du contenu -----------------------

function StepperBanner({ steps }: { steps: Step[] }) {
  const { dismissed } = useProto();
  const next = nextStep(steps);
  if (dismissed || !next) return null;
  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b bg-accent/40 px-6 text-sm">
      <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
      <ol className="flex min-w-0 items-center gap-1 overflow-hidden">
        {steps.map((s, k) => (
          <li key={s.key} className="flex items-center gap-1">
            {k > 0 && <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />}
            <Link
              to={s.path}
              className={cn(
                "flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 hover:bg-accent",
                s.done && "text-muted-foreground",
                s === next && "bg-card font-semibold shadow-xs",
              )}
            >
              {s.done && <Check className="size-3.5 text-emerald-600" />}
              {s.label}
            </Link>
          </li>
        ))}
      </ol>
      <Button asChild size="sm" className="ml-auto h-7">
        <Link to={next.path}>
          {next.action} <ChevronRight />
        </Link>
      </Button>
      <button
        type="button"
        aria-label="Masquer le guide"
        className="rounded p-1 text-muted-foreground hover:bg-accent"
        onClick={() => store.set({ dismissed: true })}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function TopBarReopen({ steps }: { steps: Step[] }) {
  const { dismissed } = useProto();
  const next = nextStep(steps);
  if (!dismissed || !next) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <button
      type="button"
      title="Rouvrir le guide de démarrage"
      className="flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs shadow-xs hover:bg-accent"
      onClick={() => store.set({ dismissed: false })}
    >
      <Compass className="size-3.5" /> Démarrage {done}/{steps.length}
    </button>
  );
}

// --- Variante C : fondu dans la navigation ---------------------------------

/** Pastille sur un onglet des Référentiels : numéro d'étape ou coche. */
export function ReferentielTabMark({ path }: { path: string }) {
  const { variant } = useProto();
  const steps = useSteps();
  if (variant !== "C") return null;
  const index = steps.findIndex((s) => s.path === `/referentiels/${path}`);
  if (index < 0 || steps.every((s) => s.done)) return null;
  const step = steps[index] as Step;
  const isNext = step === nextStep(steps);
  return (
    <span
      className={cn(
        "ml-1.5 inline-flex size-4 items-center justify-center rounded-full text-[10px]",
        step.done
          ? "bg-emerald-600/15 text-emerald-700"
          : isNext
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
      )}
    >
      {step.done ? <Check className="size-2.5" /> : index + 1}
    </span>
  );
}

/** Accueil du planning tant qu'il manque des étapes (remplace l'état vide « Aucun court »). */
export function PlanningWelcome({ fallback }: { fallback: ReactNode }) {
  const { variant } = useProto();
  const steps = useSteps();
  const next = nextStep(steps);
  if (variant !== "C" || !next || next.key === "planning") return fallback;
  return (
    <div className="mx-auto mt-6 w-full max-w-lg rounded-xl border p-6">
      <p className="font-semibold text-lg">Avant de construire le planning</p>
      <p className="mt-1 text-muted-foreground text-sm">
        Le planning place des cours sur des courts, avec un moniteur et un groupe. Saisissez-les
        dans cet ordre :
      </p>
      <ol className="mt-4 flex flex-col gap-2">
        {steps.slice(0, -1).map((s, k) => (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-full text-xs",
                s.done ? "bg-emerald-600/15 text-emerald-700" : "bg-muted",
              )}
            >
              {s.done ? <Check className="size-3.5" /> : k + 1}
            </span>
            <span className={cn(s.done && "text-muted-foreground line-through")}>{s.label}</span>
            {s === next && (
              <Button asChild size="sm" className="ml-auto h-7">
                <Link to={s.path}>{s.action}</Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-muted-foreground text-xs">
        Niveaux et fermetures sont facultatifs et peuvent attendre.
      </p>
    </div>
  );
}

// --- Points de montage dans la coque ----------------------------------------

/** Dans la barre latérale, au-dessus de la section « Application ». */
export function SidebarSlot() {
  const { variant } = useProto();
  const steps = useSteps();
  if (variant !== "A") return null;
  return (
    <>
      <SidebarCard steps={steps} />
      <ReopenLink steps={steps} />
    </>
  );
}

/** Sous la barre haute du contenu. */
export function MainTopSlot() {
  const { variant } = useProto();
  const steps = useSteps();
  return (
    <>
      {variant === "B" && <StepperBanner steps={steps} />}
      <Toast steps={steps} />
    </>
  );
}

/** Dans la barre haute, à gauche du sélecteur de saison. */
export function TopBarSlot() {
  const { variant } = useProto();
  const steps = useSteps();
  return variant === "B" ? <TopBarReopen steps={steps} /> : null;
}

// --- Barre flottante de choix de variante -----------------------------------

export function PrototypeSwitcher() {
  const { variant } = useProto();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || !e.altKey) return;
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!import.meta.env.DEV) return null;
  const cycle = (delta: number) => {
    const k = (VARIANTS.indexOf(store.variant) + delta + VARIANTS.length) % VARIANTS.length;
    store.set({ variant: VARIANTS[k], dismissed: false });
  };
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-900 px-2 py-1.5 text-white text-xs shadow-xl ring-2 ring-fuchsia-500">
      <button type="button" className="rounded-full p-1 hover:bg-white/15" onClick={() => cycle(-1)}>
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-2 font-medium">
        PROTOTYPE {variant} ({NAMES[variant]})
      </span>
      <button type="button" className="rounded-full p-1 hover:bg-white/15" onClick={() => cycle(1)}>
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
