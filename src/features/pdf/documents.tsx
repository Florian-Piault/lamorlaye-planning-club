/**
 * Documents PDF (@react-pdf/renderer) : planning de la semaine, planning par
 * moniteur, feuilles d'appel (SPECS.md §9.2).
 *
 * Ce module n'est chargé qu'à la demande (`render.ts`, import dynamique) pour
 * ne pas alourdir l'application. La police Inter est embarquée dans le module
 * (URL `data:` produite par Vite) : aucun chargement réseau, rendu identique
 * sur les trois OS. Les données sont préparées par `model.ts`.
 */

import interRegular from "@fontsource/inter/files/inter-latin-400-normal.woff?inline";
import interBold from "@fontsource/inter/files/inter-latin-700-normal.woff?inline";
import interExtRegular from "@fontsource/inter/files/inter-latin-ext-400-normal.woff?inline";
import interExtBold from "@fontsource/inter/files/inter-latin-ext-700-normal.woff?inline";
import { Document, Font, Page, pdf, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { formatDate } from "@/domain/time";
import type { AttendanceSheet, InstructorSheet, PaperSize, SheetBlock, WeekSheet } from "./model";

// Pas de césure automatique (noms de groupes, prénoms).
Font.registerHyphenationCallback((word) => [word]);

let fontGeneration = 0;

/**
 * Enregistre la police pour un document : Inter, avec en repli les caractères
 * latins étendus (noms d'élèves). Les familles sont propres à chaque document
 * et retirées ensuite : avec @react-pdf 4, une police partagée entre deux
 * documents perd, dans le second, les caractères déjà utilisés par le premier.
 */
function registerFonts(): string[] {
  fontGeneration += 1;
  const main = `Inter-${fontGeneration}`;
  const extended = `InterExt-${fontGeneration}`;
  Font.register({
    family: main,
    fonts: [
      { src: interRegular, fontWeight: 400 },
      { src: interBold, fontWeight: 700 },
    ],
  });
  Font.register({
    family: extended,
    fonts: [
      { src: interExtRegular, fontWeight: 400 },
      { src: interExtBold, fontWeight: 700 },
    ],
  });
  return [main, extended];
}

function unregisterFonts(families: readonly string[]) {
  const registered = Font.getRegisteredFonts();
  for (const family of families) delete registered[family];
}

const INK = "#0F172A";
const MUTED = "#475569";
const LINE = "#94A3B8";
const LIGHT_LINE = "#CBD5E1";
const CLOSED = "#E2E8F0";

/** Dimensions des pages en paysage (points PDF). */
const LANDSCAPE: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 842, height: 595 },
  A3: { width: 1191, height: 842 },
};

const base = StyleSheet.create({
  page: { color: INK, fontSize: 9, padding: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  title: { fontSize: 14, fontWeight: 700 },
  subtitle: { fontSize: 10, color: MUTED, marginTop: 2 },
  meta: { fontSize: 7, color: MUTED, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 10,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: MUTED,
  },
  swatch: {
    borderWidth: 0.75,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
});

export interface DocumentMeta {
  /** Titre du document (propriétés du PDF). */
  title: string;
  /** Nom de la saison et date d'édition, en pied de page. */
  seasonName: string;
  printedOn: string;
}

/** Métadonnées et familles de police du document en cours de rendu. */
type RenderMeta = DocumentMeta & { fonts: string[] };

function Footer({ meta }: { meta: DocumentMeta }) {
  return (
    <View style={base.footer} fixed>
      <Text>
        Kairos · saison {meta.seasonName} · édité le {formatDate(meta.printedOn)}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

/** Pastille du moniteur : initiales écrites (lisibles en noir et blanc) sur sa couleur claire. */
function InstructorBadge({
  initials,
  color,
  size,
}: {
  initials: string;
  color: string;
  size: number;
}) {
  return (
    <View
      style={[
        base.swatch,
        { width: size * 2.4, height: size * 1.6, borderLeftWidth: 3, borderLeftColor: color },
      ]}
    >
      <Text style={{ fontSize: size, fontWeight: 700 }}>{initials}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Planning de la semaine
// ---------------------------------------------------------------------------

const AXIS = 30;
const DAY_HEADER = 13;
const COURT_HEADER = 11;

function WeekBlock({
  block,
  x,
  y,
  width,
  height,
  scale,
}: {
  block: SheetBlock;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}) {
  const fontSize = 5.6 * scale;
  return (
    <View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        backgroundColor: block.background,
        borderWidth: 0.6,
        borderColor: block.cancelled ? MUTED : block.color,
        borderStyle: block.cancelled ? "dashed" : "solid",
        borderLeftWidth: block.cancelled ? 0.6 : 2.5,
        paddingHorizontal: 1.5,
        paddingVertical: 1,
        overflow: "hidden",
      }}
    >
      <Text
        style={{
          fontSize,
          lineHeight: 1.15,
          color: block.cancelled ? MUTED : INK,
          textDecoration: block.cancelled ? "line-through" : "none",
        }}
      >
        <Text style={{ fontWeight: 700 }}>{block.initials}</Text> {block.groupName}
      </Text>
      <Text style={{ fontSize, lineHeight: 1.15, color: block.cancelled ? MUTED : INK }}>
        {block.time}
        {block.size ? ` · ${block.size}` : ""}
      </Text>
      {block.tag && (
        <Text style={{ fontSize, lineHeight: 1.15, fontWeight: 700 }}>{block.tag}</Text>
      )}
    </View>
  );
}

export function WeekDocument({
  sheet,
  paper,
  meta,
}: {
  sheet: WeekSheet;
  paper: PaperSize;
  meta: RenderMeta;
}) {
  const size = LANDSCAPE[paper];
  const scale = paper === "A3" ? 1.3 : 1;
  const padding = 24;
  const headerHeight = 34;
  const legendHeight = (sheet.legend.length > 6 ? 46 : 32) * scale + 12 * sheet.notes.length;
  const gridWidth = size.width - 2 * padding - AXIS;
  const gridHeight =
    size.height -
    2 * padding -
    headerHeight -
    (DAY_HEADER + COURT_HEADER) * scale -
    legendHeight -
    8;
  const courtCount = Math.max(sheet.courts.length, 1);
  const dayWidth = gridWidth / Math.max(sheet.days.length, 1);
  const columnWidth = dayWidth / courtCount;
  const span = sheet.dayEnd - sheet.dayStart || 60;
  const yOf = (minute: number) => ((minute - sheet.dayStart) / span) * gridHeight;

  return (
    <Document title={meta.title} author="Kairos" creator="Kairos" language="fr">
      <Page size={paper} orientation="landscape" style={[base.page, { fontFamily: meta.fonts }]}>
        <View style={[base.header, { height: headerHeight }]}>
          <View>
            <Text style={[base.title, { fontSize: 14 * scale }]}>{sheet.title}</Text>
            <Text style={[base.subtitle, { fontSize: 10 * scale }]}>{sheet.subtitle}</Text>
          </View>
          <Text style={base.meta}>Total de la semaine : {sheet.totalHours}</Text>
        </View>

        {/* En-têtes des jours et des courts */}
        <View style={{ flexDirection: "row", marginLeft: AXIS }}>
          {sheet.days.map((day) => (
            <View
              key={day.weekday}
              style={{ width: dayWidth, borderLeftWidth: 1, borderColor: INK, paddingLeft: 2 }}
            >
              <Text style={{ fontSize: 7.5 * scale, fontWeight: 700, height: DAY_HEADER * scale }}>
                {day.label}
              </Text>
              <View style={{ flexDirection: "row", height: COURT_HEADER * scale }}>
                {sheet.courts.map((court) => (
                  <Text
                    key={court.id}
                    style={{ width: columnWidth, fontSize: 6 * scale, color: MUTED }}
                  >
                    {court.label}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Grille */}
        <View style={{ flexDirection: "row", height: gridHeight }}>
          <View style={{ width: AXIS, position: "relative" }}>
            {sheet.ticks.map((minute) => (
              <Text
                key={minute}
                style={{
                  position: "absolute",
                  top: Math.max(0, yOf(minute) - 3),
                  right: 3,
                  fontSize: 6 * scale,
                  color: MUTED,
                }}
              >
                {`${Math.floor(minute / 60)}h`}
              </Text>
            ))}
          </View>
          <View
            style={{
              width: gridWidth,
              height: gridHeight,
              position: "relative",
              borderWidth: 1,
              borderColor: INK,
            }}
          >
            {sheet.ticks.map((minute) => (
              <View
                key={`ligne-${minute}`}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: yOf(minute),
                  borderTopWidth: 0.4,
                  borderColor: LIGHT_LINE,
                }}
              />
            ))}
            {sheet.days.map((day, dayIndex) => (
              <View
                key={`jour-${day.weekday}`}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: dayIndex * dayWidth,
                  width: dayWidth,
                  borderLeftWidth: dayIndex === 0 ? 0 : 1,
                  borderColor: INK,
                  backgroundColor: day.closure ? CLOSED : undefined,
                }}
              >
                {sheet.courts.slice(1).map((court, i) => (
                  <View
                    key={court.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: (i + 1) * columnWidth,
                      borderLeftWidth: 0.4,
                      borderColor: LINE,
                    }}
                  />
                ))}
                {day.closure && (
                  <Text
                    style={{
                      marginTop: 4,
                      marginHorizontal: 3,
                      fontSize: 7 * scale,
                      fontWeight: 700,
                      color: MUTED,
                    }}
                  >
                    {day.closure}
                  </Text>
                )}
              </View>
            ))}
            {sheet.blocks.map((block) => (
              <WeekBlock
                key={block.id}
                block={block}
                scale={scale}
                x={
                  (block.dayIndex * courtCount + block.courtIndex + block.left) * columnWidth + 0.8
                }
                y={block.top * gridHeight + 0.5}
                width={Math.max(block.width * columnWidth - 1.6, 2)}
                height={Math.max(block.height * gridHeight - 1, 2)}
              />
            ))}
          </View>
        </View>

        {/* Légende des moniteurs (initiales + nom + heures) */}
        <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {sheet.legend.map((entry) => (
            <View
              key={entry.initials + entry.name}
              style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
            >
              <InstructorBadge initials={entry.initials} color={entry.color} size={6.5 * scale} />
              <Text style={{ fontSize: 7 * scale }}>
                {entry.name} — {entry.hours}
              </Text>
            </View>
          ))}
        </View>
        {sheet.notes.map((note) => (
          <Text key={note} style={{ marginTop: 3, fontSize: 6.5 * scale, color: MUTED }}>
            {note}
          </Text>
        ))}
        <Footer meta={meta} />
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Tableaux (planning par moniteur, feuilles d'appel)
// ---------------------------------------------------------------------------

const table = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: LINE,
    minHeight: 16,
    alignItems: "center",
  },
  head: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: INK,
    backgroundColor: "#F1F5F9",
    minHeight: 16,
    alignItems: "center",
  },
  cell: { paddingHorizontal: 3, paddingVertical: 2, fontSize: 8 },
  headCell: { paddingHorizontal: 3, paddingVertical: 2, fontSize: 7.5, fontWeight: 700 },
});

interface Column {
  label: string;
  width?: number;
}

function TableHead({ columns }: { columns: readonly Column[] }) {
  return (
    <View style={table.head} fixed>
      {columns.map((c, i) => (
        <Text
          // biome-ignore lint/suspicious/noArrayIndexKey: colonnes fixes.
          key={i}
          style={[
            table.headCell,
            c.width ? { width: c.width } : { flex: 1 },
            // Colonnes vierges (présences) : séparées, pour y écrire la date.
            c.label === "" ? { borderLeftWidth: 0.5, borderColor: LINE, alignSelf: "stretch" } : {},
          ]}
        >
          {c.label}
        </Text>
      ))}
    </View>
  );
}

const INSTRUCTOR_COLUMNS: Column[] = [
  { label: "Jour", width: 92 },
  { label: "Horaire", width: 62 },
  { label: "Durée", width: 40 },
  { label: "Court", width: 62 },
  { label: "Groupe", width: 100 },
  { label: "Effectif", width: 40 },
  { label: "Remarques" },
];

function InstructorPage({ sheet, meta }: { sheet: InstructorSheet; meta: RenderMeta }) {
  return (
    <Page size="A4" style={[base.page, { fontFamily: meta.fonts, paddingBottom: 36 }]}>
      <View style={[base.header, { justifyContent: "flex-start", gap: 8 }]}>
        <InstructorBadge initials={sheet.initials} color={sheet.color} size={11} />
        <View>
          <Text style={base.title}>Planning de {sheet.title}</Text>
          <Text style={base.subtitle}>{sheet.subtitle}</Text>
        </View>
      </View>
      <TableHead columns={INSTRUCTOR_COLUMNS} />
      {sheet.sessions.length === 0 && (
        <Text style={[table.cell, { marginTop: 6, color: MUTED }]}>
          Aucune séance cette semaine.
        </Text>
      )}
      {sheet.sessions.map((s) => {
        const style = s.struck ? { color: MUTED, textDecoration: "line-through" as const } : {};
        const values = [s.day, s.time, s.duration, s.court, s.group, s.size];
        return (
          <View key={s.key} style={table.row} wrap={false}>
            {values.map((value, i) => (
              <Text
                // biome-ignore lint/suspicious/noArrayIndexKey: colonnes fixes.
                key={i}
                style={[table.cell, { width: INSTRUCTOR_COLUMNS[i]?.width }, style]}
              >
                {value}
              </Text>
            ))}
            <Text style={[table.cell, { flex: 1 }]}>{s.remarks}</Text>
          </View>
        );
      })}
      <Text style={{ marginTop: 8, fontSize: 9, fontWeight: 700 }}>
        Total : {sheet.totalHours} ({sheet.sessionCount} séance{sheet.sessionCount > 1 ? "s" : ""})
      </Text>
      <Text style={{ marginTop: 3, fontSize: 7, color: MUTED }}>
        Les séances barrées (annulées ou assurées par un remplaçant) ne sont pas comptées.
      </Text>
      <Footer meta={meta} />
    </Page>
  );
}

export function InstructorsDocument({
  sheets,
  meta,
}: {
  sheets: readonly InstructorSheet[];
  meta: RenderMeta;
}) {
  return (
    <Document title={meta.title} author="Kairos" creator="Kairos" language="fr">
      {sheets.map((sheet) => (
        <InstructorPage key={sheet.instructorId} sheet={sheet} meta={meta} />
      ))}
    </Document>
  );
}

function attendanceColumns(columns: number): Column[] {
  return [
    { label: "N°", width: 20 },
    { label: "Élève", width: 128 },
    { label: "Téléphone", width: 70 },
    { label: "Naissance", width: 54 },
    { label: "Responsable légal", width: 140 },
    ...Array.from({ length: columns }, () => ({ label: "", width: 0 })),
  ];
}

function AttendancePage({ sheet, meta }: { sheet: AttendanceSheet; meta: RenderMeta }) {
  const columns = attendanceColumns(sheet.columns);
  const fixedWidth = columns.reduce((sum, c) => sum + (c.width ?? 0), 0);
  const presenceWidth = (LANDSCAPE.A4.width - 48 - fixedWidth) / sheet.columns;
  const sized = columns.map((c) => (c.width === 0 ? { ...c, width: presenceWidth } : c));
  const presence = Array.from({ length: sheet.columns }, (_, i) => i);
  const cellBorder = { borderLeftWidth: 0.5, borderColor: LINE, alignSelf: "stretch" as const };
  return (
    <Page
      size="A4"
      orientation="landscape"
      style={[base.page, { fontFamily: meta.fonts, paddingBottom: 36 }]}
    >
      <View style={base.header}>
        <View>
          <Text style={base.title}>Feuille d'appel — {sheet.title}</Text>
          <Text style={base.subtitle}>{sheet.details}</Text>
          {sheet.slots.map((slot) => (
            <Text key={slot} style={{ fontSize: 8, marginTop: 2 }}>
              {slot}
            </Text>
          ))}
        </View>
        <Text style={base.meta}>Indiquer la date en tête de chaque colonne de présence.</Text>
      </View>
      <TableHead columns={sized} />
      {sheet.rows.map((row) => (
        <View key={row.index} style={[table.row, { minHeight: 18 }]} wrap={false}>
          <Text style={[table.cell, { width: 20 }]}>{row.index}</Text>
          <Text style={[table.cell, { width: 128, fontWeight: 700 }]}>{row.name}</Text>
          <Text style={[table.cell, { width: 70 }]}>{row.phone}</Text>
          <Text style={[table.cell, { width: 54 }]}>{row.birthDate}</Text>
          <Text style={[table.cell, { width: 140 }]}>{row.guardian}</Text>
          {presence.map((i) => (
            <View key={i} style={[{ width: presenceWidth }, cellBorder]} />
          ))}
        </View>
      ))}
      {Array.from({ length: sheet.blankRows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lignes vierges.
        <View key={`vierge-${i}`} style={[table.row, { minHeight: 18 }]} wrap={false}>
          <View style={{ width: fixedWidth }} />
          {presence.map((j) => (
            <View key={j} style={[{ width: presenceWidth }, cellBorder]} />
          ))}
        </View>
      ))}
      {sheet.rows.length === 0 && (
        <Text style={{ marginTop: 6, fontSize: 8, color: MUTED }}>
          Aucun élève inscrit dans ce groupe.
        </Text>
      )}
      <Footer meta={meta} />
    </Page>
  );
}

export function AttendanceDocument({
  sheets,
  meta,
}: {
  sheets: readonly AttendanceSheet[];
  meta: RenderMeta;
}) {
  return (
    <Document title={meta.title} author="Kairos" creator="Kairos" language="fr">
      {sheets.map((sheet) => (
        <AttendancePage key={sheet.groupId} sheet={sheet} meta={meta} />
      ))}
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

export type PdfContent =
  | { kind: "week"; sheet: WeekSheet; paper: PaperSize }
  | { kind: "instructors"; sheets: readonly InstructorSheet[] }
  | { kind: "attendance"; sheets: readonly AttendanceSheet[] };

function pdfElement(content: PdfContent, meta: RenderMeta): ReactElement {
  switch (content.kind) {
    case "week":
      return <WeekDocument sheet={content.sheet} paper={content.paper} meta={meta} />;
    case "instructors":
      return <InstructorsDocument sheets={content.sheets} meta={meta} />;
    case "attendance":
      return <AttendanceDocument sheets={content.sheets} meta={meta} />;
  }
}

/** Produit les octets du PDF. */
export async function renderPdfBytes(content: PdfContent, meta: DocumentMeta): Promise<Uint8Array> {
  const fonts = registerFonts();
  try {
    // biome-ignore lint/suspicious/noExplicitAny: `pdf()` attend un élément <Document>.
    const blob = await pdf(pdfElement(content, { ...meta, fonts }) as any).toBlob();
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    unregisterFonts(fonts);
  }
}
