/**
 * PROTOTYPE — à jeter. Question : quelle icône et quel nom pour l'application ?
 *
 * Quatre couples icône + nom, permutables via `?variant=` (A à D), placé AVANT
 * le `#` du HashRouter pour survivre à la navigation : `/?variant=B#/planning`.
 * La barre flottante (← / →) change de variante ; « Planche » ouvre les icônes
 * aux tailles réelles (Dock, barre des tâches, favicon 16 px) sur fond clair et sombre.
 * Visible uniquement en développement (`import.meta.env.DEV`).
 */
import { ChevronLeft, ChevronRight, LayoutGrid, X } from "lucide-react";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";

const BLUE = "#2a5bd7";
const BLUE_DARK = "#1d3f9e";
const NAVY = "#18203a";
const BALL = "#cde63a";
const PAPER = "#f6f8fc";

/** Balle de tennis : disque jaune et couture. */
function Ball({ cx, cy, r, stroke = "#ffffff" }: { cx: number; cy: number; r: number; stroke?: string }) {
  const w = r * 0.13;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={BALL} />
      <path
        d={`M${cx - r * 0.95} ${cy - r * 0.3} C ${cx - r * 0.35} ${cy - r * 0.15}, ${cx - r * 0.35} ${cy + r * 0.55}, ${cx - r * 0.55} ${cy + r * 0.82}`}
        fill="none"
        stroke={stroke}
        strokeWidth={w}
        strokeLinecap="round"
      />
      <path
        d={`M${cx + r * 0.95} ${cy + r * 0.3} C ${cx + r * 0.35} ${cy + r * 0.15}, ${cx + r * 0.35} ${cy - r * 0.55}, ${cx + r * 0.55} ${cy - r * 0.82}`}
        fill="none"
        stroke={stroke}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </g>
  );
}

function Svg({ size, children, id }: { size: number; children: ReactNode; id: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      aria-hidden
      data-icon={id}
    >
      {children}
    </svg>
  );
}

/** A — Planning Club, refonte : le calendrier actuel repeint aux couleurs du thème. */
function IconA({ size }: { size: number }) {
  return (
    <Svg size={size} id="A">
      <defs>
        <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b6ef0" />
          <stop offset="1" stopColor={BLUE_DARK} />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="224" fill="url(#gA)" />
      <rect x="168" y="220" width="688" height="620" rx="64" fill={PAPER} />
      <path d="M168 284a64 64 0 0 1 64-64h560a64 64 0 0 1 64 64v84H168z" fill={NAVY} />
      <rect x="320" y="172" width="44" height="112" rx="22" fill={PAPER} />
      <rect x="660" y="172" width="44" height="112" rx="22" fill={PAPER} />
      <g fill={BLUE} opacity=".22">
        <rect x="224" y="420" width="170" height="150" rx="24" />
        <rect x="427" y="420" width="170" height="150" rx="24" />
        <rect x="224" y="610" width="170" height="170" rx="24" />
      </g>
      <rect x="630" y="420" width="170" height="150" rx="24" fill={BLUE} />
      <rect x="427" y="610" width="170" height="170" rx="24" fill={BLUE} />
      <Ball cx={720} cy={700} r={120} stroke={PAPER} />
    </Svg>
  );
}

// --- Surfaces du court (icône B), réglables indépendamment du nom via ?surface=. ---

export interface Surface {
  key: string;
  label: string;
  outer: string;
  inner: string;
  stripe?: string;
  net: string;
}

export const SURFACES: Surface[] = [
  { key: "dur", label: "Dur bleu", outer: BLUE_DARK, inner: BLUE, net: NAVY },
  { key: "terre", label: "Terre battue", outer: "#9c4423", inner: "#d0683c", net: "#4a1e0e" },
  { key: "gazon", label: "Gazon", outer: "#2d5f27", inner: "#4c8d3b", stripe: "#56993f", net: "#16330f" },
  { key: "us", label: "Dur vert/bleu", outer: "#3e7d57", inner: "#2f63b8", net: NAVY },
  { key: "indoor", label: "Moquette indoor", outer: "#4b2e6b", inner: "#2a7f86", net: "#1d1430" },
];

/** B — le court vu du dessus, la balle posée dans un carré de service. */
function IconB({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  const line = { stroke: "#ffffff", strokeWidth: 18, fill: "none" } as const;
  return (
    <Svg size={size} id={`B-${sf.key}`}>
      <rect width="1024" height="1024" rx="224" fill={sf.outer} />
      <rect x="152" y="112" width="720" height="800" rx="28" fill={sf.inner} />
      {sf.stripe &&
        [0, 2, 4, 6].map((i) => (
          <rect key={i} x="152" y={112 + i * 100} width="720" height="100" fill={sf.stripe} />
        ))}
      <rect x="232" y="172" width="560" height="680" {...line} />
      <line x1="300" y1="172" x2="300" y2="852" {...line} />
      <line x1="724" y1="172" x2="724" y2="852" {...line} />
      <line x1="300" y1="332" x2="724" y2="332" {...line} />
      <line x1="300" y1="692" x2="724" y2="692" {...line} />
      <line x1="512" y1="332" x2="512" y2="692" {...line} />
      <line x1="196" y1="512" x2="828" y2="512" stroke={sf.net} strokeWidth="30" strokeLinecap="round" />
      <ellipse cx="628" cy="636" rx="74" ry="20" fill={sf.net} opacity=".35" />
      <Ball cx={612} cy={590} r={74} />
    </Svg>
  );
}

/** C — Créneau : trois créneaux horaires en barres, le dernier se termine par la balle. */
function IconC({ size }: { size: number }) {
  return (
    <Svg size={size} id="C">
      <rect width="1024" height="1024" rx="224" fill={NAVY} />
      <rect x="196" y="232" width="520" height="132" rx="66" fill={BLUE} />
      <rect x="320" y="446" width="508" height="132" rx="66" fill="#ffffff" />
      <rect x="196" y="660" width="380" height="132" rx="66" fill={BLUE} opacity=".55" />
      <Ball cx={720} cy={726} r={112} stroke={NAVY} />
    </Svg>
  );
}

/** D — TCL Planning : blason du club, monogramme et balle. */
function IconD({ size }: { size: number }) {
  return (
    <Svg size={size} id="D">
      <rect width="1024" height="1024" rx="224" fill={PAPER} />
      <path
        d="M512 128 L832 216 V500 C832 700 700 832 512 904 C324 832 192 700 192 500 V216 Z"
        fill={BLUE}
      />
      <path
        d="M512 176 L784 252 V500 C784 676 672 788 512 852 C352 788 240 676 240 500 V252 Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="14"
        opacity=".6"
      />
      <text
        x="512"
        y="540"
        textAnchor="middle"
        fontFamily="Inter Variable, Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="230"
        letterSpacing="-8"
        fill="#ffffff"
      >
        TCL
      </text>
      <Ball cx={512} cy={700} r={78} stroke={BLUE} />
    </Svg>
  );
}

export interface BrandVariant {
  key: string;
  name: string;
  tagline: string;
  concept: string;
  Icon: (props: { size: number; surface?: Surface }) => ReactNode;
}

/** Premier tour (A–D), écarté au profit de l'icône B : gardé pour l'archive. */
export const ROUND_1: BrandVariant[] = [
  { key: "A", name: "Planning Club", tagline: "Cours collectifs", concept: "Nom actuel, calendrier repeint", Icon: IconA },
  { key: "B", name: "Court Central", tagline: "Planning des cours", concept: "Le court vu du dessus", Icon: IconB },
  { key: "C", name: "Créneau", tagline: "Cours collectifs de tennis", concept: "Créneaux qui finissent en balle", Icon: IconC },
  { key: "D", name: "TCL Planning", tagline: "Tennis Club de Lamorlaye", concept: "Blason et monogramme", Icon: IconD },
];

/** Deuxième tour : icône B, noms en jeux de mots tennis × planning. */
export const ROUND_2: BrandVariant[] = [
  { key: "1", name: "Tamis", tagline: "Planning des cours collectifs", concept: "Tête de raquette / tamiser = trier les élèves en groupes", Icon: IconB },
  { key: "2", name: "Emploi du Tennis", tagline: "Cours collectifs du club", concept: "« Emploi du temps » détourné", Icon: IconB },
  { key: "3", name: "Courtier", tagline: "Planning des cours collectifs", concept: "Celui qui répartit les courts", Icon: IconB },
  { key: "4", name: "À la volée", tagline: "Planning des cours collectifs", concept: "La volée / ajuster le planning à la volée", Icon: IconB },
  { key: "5", name: "Cordage", tagline: "Planning des cours collectifs", concept: "Les cordes d'une raquette forment une grille", Icon: IconB },
  { key: "6", name: "Terrain d'entente", tagline: "Planning des cours collectifs", concept: "Le terrain / mettre moniteurs, élèves et courts d'accord", Icon: IconB },
  { key: "7", name: "Ocre", tagline: "Planning des cours collectifs", concept: "La couleur de la terre battue, un mot court", Icon: IconB },
  { key: "8", name: "Terre à terre", tagline: "Planning des cours collectifs", concept: "La terre battue / un outil simple et pratique", Icon: IconB },
];

// --- Troisième tour : Kairos, dieu du moment opportun (fresque de Salviati). ---

const CREAM = "#fff3e2";

/** Fond terre battue en dégradé, commun aux icônes Kairos. */
function ClayBg({ sf, id }: { sf: Surface; id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sf.inner} />
          <stop offset="1" stopColor={sf.outer} />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="224" fill={`url(#${id})`} />
    </>
  );
}

/** Plume en amande, racine à l'origine, pointe vers la gauche. */
function Feather({ length, width, fill, rotate, x, y }: { length: number; width: number; fill: string; rotate: number; x: number; y: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${rotate})`}
      d={`M0 0 C ${-length * 0.3} ${-width}, ${-length * 0.8} ${-width}, ${-length} 0 C ${-length * 0.8} ${width * 0.35}, ${-length * 0.3} ${width * 0.35}, 0 0 Z`}
      fill={fill}
    />
  );
}

/** Aile gauche : plumes en éventail, de la plus longue (haut) à la plus courte. */
function Wing({ x, y, scale, color }: { x: number; y: number; scale: number; color: string }) {
  const feathers = [
    { rotate: 68, length: 440, op: 1 },
    { rotate: 50, length: 390, op: 0.85 },
    { rotate: 33, length: 330, op: 0.7 },
    { rotate: 17, length: 260, op: 0.55 },
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {feathers.map((f) => (
        <g key={f.rotate} opacity={f.op}>
          <Feather x={0} y={0} length={f.length} width={88} rotate={f.rotate} fill={color} />
        </g>
      ))}
    </g>
  );
}

function Mirror({ children }: { children: ReactNode }) {
  return <g transform="translate(1024 0) scale(-1 1)">{children}</g>;
}

/** K1 — Les ailes déployées vers le haut, la balle à leur naissance. */
function IconK1({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  return (
    <Svg size={size} id={`K1-${sf.key}`}>
      <ClayBg sf={sf} id={`k1-${sf.key}`} />
      <Wing x={480} y={700} scale={1.25} color={CREAM} />
      <Mirror>
        <Wing x={480} y={700} scale={1.25} color={CREAM} />
      </Mirror>
      <Ball cx={512} cy={740} r={135} stroke={sf.inner} />
    </Svg>
  );
}

/** K2 — La mèche : la balle-tête et la touffe de cheveux qu'on saisit au vol. */
function IconK2({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  return (
    <Svg size={size} id={`K2-${sf.key}`}>
      <ClayBg sf={sf} id={`k2-${sf.key}`} />
      <path d="M370 430 C 320 330, 350 230, 430 170 C 415 250, 430 330, 465 400 Z" fill="#f0d6b8" />
      <path
        d="M410 420 C 380 280, 480 170, 640 158 C 705 154, 760 170, 805 205 C 725 195, 655 210, 605 245 C 555 280, 515 335, 495 385 Z"
        fill={CREAM}
      />
      <path
        d="M480 400 C 505 320, 575 275, 670 272 C 715 272, 750 285, 780 305 C 715 303, 655 318, 610 345 C 578 365, 552 385, 535 405 Z"
        fill="#f0d6b8"
      />
      <Ball cx={480} cy={630} r={240} stroke={sf.inner} />
    </Svg>
  );
}

/** K3 — Balle ailée et mèche : les deux attributs, en petit. */
function IconK3({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  return (
    <Svg size={size} id={`K3-${sf.key}`}>
      <ClayBg sf={sf} id={`k3-${sf.key}`} />
      <Wing x={390} y={600} scale={0.8} color={CREAM} />
      <Mirror>
        <Wing x={390} y={600} scale={0.8} color={CREAM} />
      </Mirror>
      <Ball cx={512} cy={580} r={170} stroke={sf.inner} />
      <path
        d="M455 425 C 430 340, 480 280, 560 278 C 620 276, 660 315, 652 365 C 630 335, 595 325, 570 335 C 548 345, 540 370, 548 400 C 515 385, 480 395, 455 425 Z"
        fill={CREAM}
      />
    </Svg>
  );
}

/** K4 — Le plumage de la fresque : aile en bandes crème, sauge et rose saumon. */
function IconK4({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  const bands = [
    { s: 1, c: CREAM },
    { s: 0.8, c: "#b9cbb0" },
    { s: 0.6, c: "#efa58c" },
    { s: 0.4, c: CREAM },
  ];
  return (
    <Svg size={size} id={`K4-${sf.key}`}>
      <ClayBg sf={sf} id={`k4-${sf.key}`} />
      <g transform="translate(250 830)">
        {bands.map((b) => (
          <path
            key={b.s}
            transform={`scale(${b.s})`}
            d="M0 0 C 40 -260, 220 -560, 560 -680 C 430 -470, 330 -240, 230 20 C 150 30, 60 25, 0 0 Z"
            fill={b.c}
          />
        ))}
      </g>
      <Ball cx={730} cy={760} r={115} stroke={sf.inner} />
    </Svg>
  );
}

const SAGE = "#b9cbb0";
const SALMON = "#efa58c";

/**
 * Plume de la fresque : amande à rachis, avec bandes colorées depuis la racine.
 * Origine à la racine ; `rotate` 90 = vers le haut, 180 = vers la droite.
 */
function Plume({
  x, y, rotate, length, width, bands = [], rachis, splits = [],
}: {
  x: number; y: number; rotate: number; length: number; width: number;
  bands?: { at: number; color: string }[]; rachis?: string; splits?: { at: number; side: 1 | -1; color: string }[];
}) {
  const shape = (l: number, w: number) =>
    `M0 0 C ${-l * 0.25} ${-w}, ${-l * 0.8} ${-w * 0.9}, ${-l} 0 C ${-l * 0.8} ${w * 0.55}, ${-l * 0.25} ${w * 0.6}, 0 0 Z`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <path d={shape(length, width)} fill={CREAM} />
      {bands.map((b) => (
        <path key={b.at} d={shape(length * b.at, width * Math.min(1, b.at + 0.25))} fill={b.color} />
      ))}
      {splits.map((sp) => (
        <line
          key={sp.at}
          x1={-length * sp.at}
          y1={0}
          x2={-length * (sp.at + 0.1)}
          y2={sp.side * width}
          stroke={sp.color}
          strokeWidth={width * 0.09}
          strokeLinecap="round"
        />
      ))}
      {rachis && (
        <line x1="0" y1="0" x2={-length * 0.92} y2={-width * 0.12} stroke={rachis} strokeWidth={width * 0.07} strokeLinecap="round" />
      )}
    </g>
  );
}

/**
 * Aile de la fresque : lame courbe (bord d'attaque à gauche), bord de fuite
 * festonné, une bosse par plume ; bandes crème, sauge, saumon depuis la racine.
 */
function bladePath(feathers: number): string {
  const R = [250, 900], L = [190, 330], T = [800, 120], C2 = [560, 560], R2 = [470, 900];
  const q = (a: number[], c: number[], b: number[], t: number) => [
    (1 - t) ** 2 * (a[0] as number) + 2 * (1 - t) * t * (c[0] as number) + t * t * (b[0] as number),
    (1 - t) ** 2 * (a[1] as number) + 2 * (1 - t) * t * (c[1] as number) + t * t * (b[1] as number),
  ];
  const pts = Array.from({ length: feathers + 1 }, (_, i) => q(T, C2, R2, i / feathers));
  let d = `M${R[0]} ${R[1]} Q ${L[0]} ${L[1]} ${T[0]} ${T[1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1] as number[];
    const [bx, by] = pts[i] as number[];
    const dx = (bx as number) - (ax as number), dy = (by as number) - (ay as number);
    const len = Math.hypot(dx, dy);
    let nx = -dy / len, ny = dx / len;
    if (nx + ny < 0) { nx = -nx; ny = -ny; }
    const bulge = len * 0.55;
    const cx = ((ax as number) + (bx as number)) / 2 + nx * bulge;
    const cy = ((ay as number) + (by as number)) / 2 + ny * bulge;
    d += ` Q ${cx} ${cy} ${bx} ${by}`;
  }
  return `${d} Z`;
}

function FrescoWing({
  x = 0, y = 0, scale = 1, palette = [CREAM, SAGE, SALMON, CREAM], feathers = 7,
}: { x?: number; y?: number; scale?: number; palette?: string[]; feathers?: number }) {
  const d = bladePath(feathers);
  const bands = [1, 0.74, 0.52, 0.3];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {bands.map((k, i) => (
        <path
          key={k}
          transform={`translate(250 900) scale(${k}) translate(-250 -900)`}
          d={d}
          fill={palette[i]}
        />
      ))}
    </g>
  );
}

/** K4A — Une grande aile, rangs de plumes aux couleurs de la fresque. */
function IconK4A({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  return (
    <Svg size={size} id={`K4A-${sf.key}`}>
      <ClayBg sf={sf} id={`k4a-${sf.key}`} />
      <FrescoWing x={10} y={20} scale={0.95} />
    </Svg>
  );
}

/** K4B — La paire d'ailes de la fresque, l'une derrière l'autre. */
function IconK4B({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  return (
    <Svg size={size} id={`K4B-${sf.key}`}>
      <ClayBg sf={sf} id={`k4b-${sf.key}`} />
      <g opacity=".75">
        <FrescoWing x={190} y={40} scale={0.84} palette={["#f3d9bf", "#a6bb9c", "#e48f76", "#f3d9bf"]} />
      </g>
      <FrescoWing x={20} y={150} scale={0.8} />
    </Svg>
  );
}

/** K4C — Éventail de plumes rayées, depuis le bas. */
function IconK4C({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  const fan = [
    { r: 50, l: 560 },
    { r: 70, l: 650 },
    { r: 90, l: 700 },
    { r: 110, l: 650 },
    { r: 130, l: 560 },
  ];
  return (
    <Svg size={size} id={`K4C-${sf.key}`}>
      <ClayBg sf={sf} id={`k4c-${sf.key}`} />
      {fan.map((f) => (
        <Plume
          key={f.r}
          x={512}
          y={880}
          rotate={f.r}
          length={f.l}
          width={95}
          bands={[{ at: 0.62, color: SAGE }, { at: 0.36, color: SALMON }]}
          rachis={sf.outer}
        />
      ))}
    </Svg>
  );
}

/** K4D — Une seule plume, comme une plume d'écriture : celle qui écrit le planning. */
function IconK4D({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  return (
    <Svg size={size} id={`K4D-${sf.key}`}>
      <ClayBg sf={sf} id={`k4d-${sf.key}`} />
      <Plume
        x={230}
        y={830}
        rotate={135}
        length={880}
        width={190}
        bands={[{ at: 0.7, color: SAGE }, { at: 0.42, color: SALMON }]}
        rachis={sf.outer}
        splits={[
          { at: 0.55, side: -1, color: sf.inner },
          { at: 0.72, side: 1, color: sf.inner },
        ]}
      />
    </Svg>
  );
}

/** K4B3 — Trois ailes étagées, de la plus estompée (fond) à la plus nette. */
function IconK4B3({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  return (
    <Svg size={size} id={`K4B3-${sf.key}`}>
      <ClayBg sf={sf} id={`k4b3-${sf.key}`} />
      <g opacity=".55">
        <FrescoWing x={290} y={0} scale={0.76} palette={["#ecc9ab", "#97ad8e", "#db8268", "#ecc9ab"]} />
      </g>
      <g opacity=".78">
        <FrescoWing x={160} y={70} scale={0.8} palette={["#f3d9bf", "#a6bb9c", "#e48f76", "#f3d9bf"]} />
      </g>
      <FrescoWing x={20} y={150} scale={0.8} />
    </Svg>
  );
}

export const ROUND_3: BrandVariant[] = [
  { key: "K1", name: "Kairos", tagline: "Planning des cours collectifs", concept: "Les ailes déployées, la balle à leur naissance", Icon: IconK1 },
  { key: "K4A", name: "Kairos", tagline: "Planning des cours collectifs", concept: "Une grande aile, rangs de plumes aux couleurs de la fresque", Icon: IconK4A },
  { key: "K4B", name: "Kairos", tagline: "Planning des cours collectifs", concept: "La paire d'ailes de la fresque", Icon: IconK4B },
  { key: "K4C", name: "Kairos", tagline: "Planning des cours collectifs", concept: "Éventail de plumes rayées", Icon: IconK4C },
  { key: "K4D", name: "Kairos", tagline: "Planning des cours collectifs", concept: "Une plume d'écriture : celle qui écrit le planning", Icon: IconK4D },
  { key: "K2", name: "Kairos", tagline: "Planning des cours collectifs", concept: "La mèche : saisir l'occasion (la balle) aux cheveux", Icon: IconK2 },
  { key: "K3", name: "Kairos", tagline: "Planning des cours collectifs", concept: "Balle ailée coiffée de la mèche", Icon: IconK3 },
  { key: "K4", name: "Kairos", tagline: "Planning des cours collectifs", concept: "Le plumage de la fresque de Salviati", Icon: IconK4 },
];

/** K4BE — La paire de K4B, ailes plus écartées (l'arrière pivote vers l'extérieur). */
function IconK4BE({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  return (
    <Svg size={size} id={`K4BE-${sf.key}`}>
      <ClayBg sf={sf} id={`k4be-${sf.key}`} />
      <g opacity=".75" transform="rotate(5 430 860)">
        <FrescoWing x={230} y={45} scale={0.82} palette={["#f3d9bf", "#a6bb9c", "#e48f76", "#f3d9bf"]} />
      </g>
      <g transform="rotate(-6 220 870)">
        <FrescoWing x={-20} y={150} scale={0.8} />
      </g>
    </Svg>
  );
}

/** K4BB — La balle de profil, la paire d'ailes de K4B naissant de son dos. */
function IconK4BB({ size, surface }: { size: number; surface?: Surface }) {
  const current = useSurface();
  const sf = surface ?? current;
  return (
    <Svg size={size} id={`K4BB-${sf.key}`}>
      <ClayBg sf={sf} id={`k4bb-${sf.key}`} />
      {/* Aile lointaine (plus petite, estompée), balle, puis aile proche par-dessus. */}
      <g opacity=".85" transform="rotate(14 485 560)">
        <FrescoWing x={330} y={2} scale={0.62} palette={["#f3d9bf", "#a6bb9c", "#e48f76", "#f3d9bf"]} />
      </g>
      <Ball cx={340} cy={700} r={175} stroke={sf.inner} />
      <FrescoWing x={215} y={54} scale={0.74} />
    </Svg>
  );
}

/** Quatrième tour : K1 et K4B retenus, K4B3 ajoute une troisième aile. */
export const BRAND_VARIANTS: BrandVariant[] = [
  { key: "K1", name: "Kairos", tagline: "Planning des cours collectifs", concept: "Les ailes déployées, la balle à leur naissance", Icon: IconK1 },
  { key: "K4B", name: "Kairos", tagline: "Planning des cours collectifs", concept: "La paire d'ailes de la fresque", Icon: IconK4B },
  { key: "K4BE", name: "Kairos", tagline: "Planning des cours collectifs", concept: "La paire de K4B, ailes plus écartées", Icon: IconK4BE },
  { key: "K4BB", name: "Kairos", tagline: "Planning des cours collectifs", concept: "La balle de profil, une aile derrière, une devant", Icon: IconK4BB },
];

/** Écarté au quatrième tour (archive). */
export const ROUND_4_DROPPED: BrandVariant[] = [
  { key: "K4B3", name: "Kairos", tagline: "Planning des cours collectifs", concept: "Trois ailes étagées", Icon: IconK4B3 },
];

// --- État de la variante : ?variant= hors du hash, pour survivre à la navigation. ---

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
function readParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}
function writeParam(name: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState(window.history.state, "", url);
  for (const l of listeners) l();
}
function readVariant(): string {
  const v = readParam("variant")?.toUpperCase();
  return BRAND_VARIANTS.some((b) => b.key === v) ? (v as string) : "K1";
}
const writeVariant = (key: string) => writeParam("variant", key);
function readSurface(): string {
  const v = readParam("surface");
  return SURFACES.some((x) => x.key === v) ? (v as string) : "terre";
}

export function useSurface(): Surface {
  const key = useSyncExternalStore(subscribe, readSurface);
  return SURFACES.find((x) => x.key === key) ?? (SURFACES[0] as Surface);
}

export function useBrandVariant(): BrandVariant {
  const key = useSyncExternalStore(subscribe, readVariant);
  const variant = BRAND_VARIANTS.find((b) => b.key === key) ?? (BRAND_VARIANTS[0] as BrandVariant);
  useEffect(() => {
    document.title = variant.name;
  }, [variant]);
  return variant;
}

// --- Barre flottante et planche d'icônes. ---

export function BrandSwitcher() {
  const variant = useBrandVariant();
  const surface = useSurface();
  const [sheet, setSheet] = useState(false);
  const index = BRAND_VARIANTS.indexOf(variant);
  const step = (delta: number) =>
    writeVariant((BRAND_VARIANTS[(index + delta + BRAND_VARIANTS.length) % BRAND_VARIANTS.length] as BrandVariant).key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Escape") setSheet(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      {sheet && <IconSheet variant={variant} onClose={() => setSheet(false)} />}
      <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-950 px-2 py-1.5 text-white text-sm shadow-2xl ring-2 ring-fuchsia-500">
        <button type="button" onClick={() => step(-1)} className="rounded-full p-1.5 hover:bg-white/15" aria-label="Variante précédente">
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-56 text-center">
          <b>{variant.key}</b> · {variant.name}
        </span>
        <button type="button" onClick={() => step(1)} className="rounded-full p-1.5 hover:bg-white/15" aria-label="Variante suivante">
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setSheet((s) => !s)}
          className="ml-1 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 hover:bg-white/20"
        >
          <LayoutGrid className="size-3.5" /> Planche
        </button>
        <span className="mx-1 h-5 w-px bg-white/20" />
        {SURFACES.map((x) => (
          <button
            key={x.key}
            type="button"
            title={x.label}
            aria-label={x.label}
            onClick={() => writeParam("surface", x.key)}
            className={`size-6 rounded-full border-2 ${x.key === surface.key ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`}
            style={{ background: `linear-gradient(135deg, ${x.outer} 50%, ${x.inner} 50%)` }}
          />
        ))}
      </div>
    </>
  );
}

const SIZES = [256, 128, 64, 32, 16];

function IconSheet({ variant, onClose }: { variant: BrandVariant; onClose: () => void }) {
  const current = useSurface();
  return (
    <div className="fixed inset-0 z-[90] overflow-auto bg-black/50 p-8 pb-24 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto flex max-w-5xl flex-col gap-6 rounded-2xl bg-white p-8 text-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-xl">
              {variant.key} — {variant.name} · {current.label}
            </p>
            <p className="text-sm text-zinc-500">{variant.concept}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-zinc-100" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>

        {/* Tailles réelles, fond clair puis sombre. */}
        {[
          { bg: "bg-zinc-100", fg: "text-zinc-500" },
          { bg: "bg-zinc-900", fg: "text-zinc-400" },
        ].map(({ bg, fg }) => (
          <div key={bg} className={`flex items-end gap-8 rounded-xl p-6 ${bg}`}>
            {SIZES.map((s) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <variant.Icon size={s} />
                <span className={`text-xs ${fg}`}>{s}px</span>
              </div>
            ))}
          </div>
        ))}

        {/* Dock macOS simulé : les surfaces côte à côte, la courante en grand. */}
        <div className="rounded-xl bg-gradient-to-br from-sky-300 via-indigo-400 to-fuchsia-400 p-6 pt-16">
          <div className="mx-auto flex w-fit items-end gap-3 rounded-3xl border border-white/40 bg-white/30 px-4 py-3 backdrop-blur">
            {SURFACES.map((x) => (
              <div key={x.key} className="flex flex-col items-center gap-1">
                <div className={x.key === current.key ? "" : "opacity-70"}>
                  <variant.Icon size={x.key === current.key ? 72 : 56} surface={x} />
                </div>
                <span className={`size-1 rounded-full ${x.key === current.key ? "bg-zinc-900" : "bg-transparent"}`} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-sm text-white">{variant.name}</p>
        </div>

        {/* Onglet de fenêtre / barre des tâches Windows : favicon 16 px + nom. */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 rounded-t-lg border border-b-0 bg-zinc-50 px-3 py-2 text-sm">
            <variant.Icon size={16} />
            <span>{variant.name}</span>
          </div>
          <div className="flex items-center gap-2 rounded bg-zinc-800 px-3 py-2 text-sm text-white">
            <variant.Icon size={24} />
            <span>{variant.name}</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg p-2">
            <variant.Icon size={64} />
            <span className="text-xs">{variant.name}.app</span>
          </div>
        </div>
      </div>
    </div>
  );
}
