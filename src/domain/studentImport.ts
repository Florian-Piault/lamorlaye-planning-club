/**
 * Import d'élèves (SPECS.md §9.1) : correspondance colonnes ↔ champs,
 * validation ligne par ligne, détection des doublons et construction de la
 * commande inversible qui réalise l'import.
 *
 * - Les valeurs sont validées par le schéma de la fiche élève
 *   (`domain/validation.ts`) ; une ligne invalide est signalée et écartée
 *   sans bloquer les autres.
 * - Doublon : même nom, prénom et date de naissance (sans tenir compte de la
 *   casse ni des accents), dans la saison ou plus haut dans le fichier.
 * - L'import entier est **une seule commande** (`Command<StudentMutation>`) :
 *   écrite en base dans une transaction, annulable puis rétablissable.
 */
import type { Group, GroupStudent, Level, Student } from "@/db/schema";
import { type Command, type CommandContext, defaultCommandContext } from "./commands";
import type { TableRow } from "./importFile";
import { normalizeText } from "./search";
import { isValidDate } from "./time";
import { type StudentInput, studentSchema, validate } from "./validation";

// ---------------------------------------------------------------------------
// Champs et correspondance des colonnes
// ---------------------------------------------------------------------------

export type ImportFieldKey =
  | "lastName"
  | "firstName"
  | "phone"
  | "birthDate"
  | "level"
  | "fftRanking"
  | "email"
  | "guardianName"
  | "guardianPhone"
  | "groups";

export interface ImportField {
  key: ImportFieldKey;
  label: string;
  required: boolean;
  /** En-têtes reconnus automatiquement (comparés sans casse, accents ni ponctuation). */
  synonyms: readonly string[];
}

export const IMPORT_FIELDS: readonly ImportField[] = [
  {
    key: "lastName",
    label: "Nom",
    required: true,
    synonyms: [
      "nom",
      "nom de famille",
      "nom eleve",
      "nom adherent",
      "nom de l adherent",
      "nom d usage",
    ],
  },
  {
    key: "firstName",
    label: "Prénom",
    required: true,
    synonyms: ["prenom", "prenom eleve", "prenom adherent", "prenom de l adherent"],
  },
  {
    key: "phone",
    label: "Téléphone",
    required: true,
    synonyms: [
      "telephone",
      "tel",
      "portable",
      "mobile",
      "telephone portable",
      "telephone mobile",
      "tel portable",
      "tel mobile",
      "numero de telephone",
    ],
  },
  {
    key: "birthDate",
    label: "Date de naissance",
    required: false,
    synonyms: [
      "date de naissance",
      "naissance",
      "date naissance",
      "ne le",
      "ne e le",
      "nee le",
      "ddn",
    ],
  },
  {
    key: "level",
    label: "Niveau",
    required: false,
    synonyms: ["niveau", "niveau galaxie", "niveau de jeu"],
  },
  {
    key: "fftRanking",
    label: "Classement FFT",
    required: false,
    synonyms: ["classement", "classement fft", "classement simple"],
  },
  {
    key: "email",
    label: "E-mail",
    required: false,
    synonyms: [
      "email",
      "e mail",
      "mail",
      "courriel",
      "adresse mail",
      "adresse email",
      "adresse e mail",
    ],
  },
  {
    key: "guardianName",
    label: "Responsable légal",
    required: false,
    synonyms: [
      "responsable legal",
      "responsable",
      "nom du responsable",
      "nom du responsable legal",
      "nom responsable",
      "representant legal",
      "parent",
    ],
  },
  {
    key: "guardianPhone",
    label: "Téléphone du responsable",
    required: false,
    synonyms: [
      "telephone du responsable",
      "telephone du responsable legal",
      "telephone responsable",
      "tel responsable",
      "tel du responsable",
      "telephone du representant legal",
      "telephone parent",
      "tel parent",
    ],
  },
  {
    key: "groups",
    label: "Groupe(s)",
    required: false,
    synonyms: ["groupe", "groupes", "groupe de cours", "cours"],
  },
];

const FIELD_BY_KEY = new Map(IMPORT_FIELDS.map((f) => [f.key, f]));

export function fieldLabel(key: ImportFieldKey): string {
  return FIELD_BY_KEY.get(key)?.label ?? key;
}

/** Colonne (indice) associée à chaque champ ; `null` : champ non importé. */
export type ColumnMapping = Record<ImportFieldKey, number | null>;

/** Correspondance mémorisée : nom de l'en-tête pour chaque champ (`null` : ignoré). */
export type SavedMapping = Partial<Record<ImportFieldKey, string | null>>;

export const emptyMapping = (): ColumnMapping =>
  Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, null])) as ColumnMapping;

/** En-tête normalisé : minuscules, sans accents ni ponctuation. */
export function normalizeHeader(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Correspondance automatique d'après les en-têtes : d'abord les en-têtes
 * identiques à un synonyme, puis ceux qui en contiennent un (le synonyme le
 * plus long l'emporte : « Téléphone du responsable » plutôt que « Téléphone »).
 * Une colonne n'est associée qu'à un seul champ.
 */
export function guessMapping(headers: readonly string[]): ColumnMapping {
  const mapping = emptyMapping();
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const assign = (key: ImportFieldKey, column: number) => {
    mapping[key] = column;
    used.add(column);
  };

  for (const field of IMPORT_FIELDS) {
    const column = normalized.findIndex(
      (h, i) => !used.has(i) && field.synonyms.some((s) => s === h),
    );
    if (column !== -1) assign(field.key, column);
  }

  const candidates = IMPORT_FIELDS.flatMap((field) =>
    field.synonyms.map((synonym) => ({ field: field.key, synonym })),
  ).sort((a, b) => b.synonym.length - a.synonym.length);
  for (const { field, synonym } of candidates) {
    if (mapping[field] !== null || synonym.length < 3) continue;
    const column = normalized.findIndex(
      (h, i) => !used.has(i) && ` ${h} `.includes(` ${synonym} `),
    );
    if (column !== -1) assign(field, column);
  }
  return mapping;
}

/**
 * Correspondance à mémoriser (noms des en-têtes). Un champ non associé n'est
 * mémorisé comme ignoré (`null`) que si une colonne lui avait été proposée
 * automatiquement : c'est alors un choix de l'utilisateur.
 */
export function toSavedMapping(headers: readonly string[], mapping: ColumnMapping): SavedMapping {
  const guessed = guessMapping(headers);
  const saved: SavedMapping = {};
  for (const { key } of IMPORT_FIELDS) {
    const column = mapping[key];
    if (column !== null) saved[key] = headers[column] ?? null;
    else if (guessed[key] !== null) saved[key] = null;
  }
  return saved;
}

/**
 * Correspondance initiale d'un fichier : la correspondance mémorisée pour les
 * en-têtes retrouvés, la correspondance automatique pour le reste. Un champ
 * mémorisé comme ignoré reste ignoré.
 */
export function restoreMapping(
  headers: readonly string[],
  saved: SavedMapping | null | undefined,
): ColumnMapping {
  const guessed = guessMapping(headers);
  if (!saved) return guessed;
  const normalized = headers.map(normalizeHeader);
  const mapping = emptyMapping();
  const used = new Set<number>();
  for (const field of IMPORT_FIELDS) {
    const header = saved[field.key];
    if (header === undefined) continue;
    if (header === null) {
      mapping[field.key] = null;
      continue;
    }
    const column = normalized.indexOf(normalizeHeader(header));
    if (column !== -1 && !used.has(column)) {
      mapping[field.key] = column;
      used.add(column);
    }
  }
  for (const field of IMPORT_FIELDS) {
    if (mapping[field.key] !== null || saved[field.key] === null) continue;
    const column = guessed[field.key];
    if (column !== null && !used.has(column)) {
      mapping[field.key] = column;
      used.add(column);
    }
  }
  return mapping;
}

/** Problèmes bloquants de la correspondance (champs obligatoires non associés). */
export function mappingProblems(mapping: ColumnMapping): string[] {
  return IMPORT_FIELDS.filter((f) => f.required && mapping[f.key] === null).map(
    (f) => `Choisissez la colonne du champ « ${f.label} ».`,
  );
}

// ---------------------------------------------------------------------------
// Normalisation des valeurs
// ---------------------------------------------------------------------------

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Date saisie dans un fichier → `AAAA-MM-JJ`, ou `null` si elle est invalide.
 * Formats acceptés : `AAAA-MM-JJ`, `JJ/MM/AAAA`, `JJ-MM-AAAA`, `JJ.MM.AAAA`
 * et les années sur deux chiffres (`JJ/MM/AA`, siècle déduit de `today`), avec
 * éventuellement une heure (`12/03/2017 00:00`).
 */
export function parseImportDate(value: string, today = new Date()): string | null {
  const text = value.trim().replace(/[ T]\d{1,2}:\d{2}(:\d{2})?$/, "");
  let iso: string | null = null;
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  const frMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    iso = `${y}-${pad(Number(m))}-${pad(Number(d))}`;
  } else if (frMatch) {
    const [, d, m, y] = frMatch;
    let year = Number(y);
    if ((y as string).length === 2) {
      const century = Math.floor(today.getFullYear() / 100) * 100;
      year = century + year > today.getFullYear() ? century - 100 + year : century + year;
    }
    iso = `${year}-${pad(Number(m))}-${pad(Number(d))}`;
  }
  return iso !== null && isValidDate(iso) ? iso : null;
}

/**
 * Téléphone : un numéro français à 9 chiffres (zéro initial perdu par Excel,
 * cellule numérique) retrouve son zéro.
 */
export function normalizePhone(value: string): string {
  const text = value.trim();
  return /^[1-9]\d{8}$/.test(text) ? `0${text}` : text;
}

/** Clé d'identité d'un élève : nom + prénom + date de naissance, sans casse ni accents. */
export function identityKey(student: {
  lastName: string;
  firstName: string;
  birthDate: string | null;
}): string {
  return [
    normalizeText(student.lastName),
    normalizeText(student.firstName),
    student.birthDate ?? "",
  ].join("|");
}

// ---------------------------------------------------------------------------
// Aperçu (plan d'import)
// ---------------------------------------------------------------------------

export type DuplicateMode = "ignore" | "update";

export interface ImportContext {
  seasonId: string;
  students: readonly Student[];
  groups: readonly Pick<Group, "id" | "name">[];
  levels: readonly Pick<Level, "id" | "label">[];
  memberships: readonly Pick<GroupStudent, "groupId" | "studentId">[];
}

export interface ImportOptions {
  mapping: ColumnMapping;
  duplicates: DuplicateMode;
  /** Date de référence (années sur deux chiffres). */
  today?: Date;
}

/**
 * - `create` : nouvel élève ;
 * - `update` : élève existant mis à jour (mode « mettre à jour ») ;
 * - `unchanged` : élève existant, rien à modifier ;
 * - `duplicate` : élève existant ignoré (mode « ignorer ») ;
 * - `error` : ligne invalide, non importée.
 */
export type RowStatus = "create" | "update" | "unchanged" | "duplicate" | "error";

type StudentValues = StudentInput;

export interface PlannedRow {
  line: number;
  status: RowStatus;
  /** Valeurs brutes des champs associés (affichage de l'aperçu). */
  raw: Record<ImportFieldKey, string>;
  /** Valeurs validées (nulles pour une ligne en erreur). */
  values: StudentValues | null;
  groupIds: string[];
  /** Élève existant correspondant (doublon). */
  existingId: string | null;
  /** Valeurs modifiées d'un élève existant (`update`). */
  changes: Partial<StudentValues>;
  /** Inscriptions à ajouter (groupes dont l'élève ne fait pas encore partie). */
  newGroupIds: string[];
  errors: string[];
  warnings: string[];
}

export interface ImportPlan {
  rows: PlannedRow[];
  counts: Record<RowStatus, number>;
  /** Groupes et niveaux du fichier introuvables dans la saison. */
  unknownGroups: string[];
  unknownLevels: string[];
}

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

/** Champs de la fiche correspondant aux champs d'import (le niveau devient `levelId`). */
const STUDENT_FIELDS = [
  "lastName",
  "firstName",
  "phone",
  "birthDate",
  "levelId",
  "fftRanking",
  "email",
  "guardianName",
  "guardianPhone",
] as const satisfies readonly (keyof StudentValues)[];

const SCHEMA_FIELD_LABELS: Record<(typeof STUDENT_FIELDS)[number], string> = {
  lastName: "Nom",
  firstName: "Prénom",
  phone: "Téléphone",
  birthDate: "Date de naissance",
  levelId: "Niveau",
  fftRanking: "Classement FFT",
  email: "E-mail",
  guardianName: "Responsable légal",
  guardianPhone: "Téléphone du responsable",
};

/** Champs mis à jour sur un doublon (l'identité, qui a servi à le trouver, est conservée). */
const UPDATABLE_FIELDS = [
  "phone",
  "levelId",
  "fftRanking",
  "email",
  "guardianName",
  "guardianPhone",
] as const;

const IMPORT_TO_STUDENT_FIELD: Partial<Record<ImportFieldKey, (typeof UPDATABLE_FIELDS)[number]>> =
  {
    phone: "phone",
    level: "levelId",
    fftRanking: "fftRanking",
    email: "email",
    guardianName: "guardianName",
    guardianPhone: "guardianPhone",
  };

/** Recherche des groupes d'une cellule : nom complet, sinon liste séparée par `,` `;` ou `|`. */
function resolveGroups(
  value: string,
  groupsByName: ReadonlyMap<string, string>,
): { ids: string[]; unknown: string[] } {
  const text = value.trim();
  if (text === "") return { ids: [], unknown: [] };
  const whole = groupsByName.get(normalizeText(text));
  if (whole) return { ids: [whole], unknown: [] };
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const name of text
    .split(/[,;|]/)
    .map((n) => n.trim())
    .filter(Boolean)) {
    const id = groupsByName.get(normalizeText(name));
    if (id) {
      if (!ids.includes(id)) ids.push(id);
    } else unknown.push(name);
  }
  return { ids, unknown };
}

/** Analyse les lignes du fichier : validation, doublons et opérations prévues. */
export function planImport(
  rows: readonly TableRow[],
  context: ImportContext,
  options: ImportOptions,
): ImportPlan {
  const { mapping, duplicates } = options;
  const groupsByName = new Map(context.groups.map((g) => [normalizeText(g.name), g.id]));
  const levelsByLabel = new Map(context.levels.map((l) => [normalizeText(l.label), l.id]));
  const existingByKey = new Map<string, Student>();
  for (const student of context.students) {
    const key = identityKey(student);
    if (!existingByKey.has(key)) existingByKey.set(key, student);
  }
  const membershipsOf = new Map<string, Set<string>>();
  for (const { groupId, studentId } of context.memberships) {
    const set = membershipsOf.get(studentId) ?? new Set<string>();
    set.add(groupId);
    membershipsOf.set(studentId, set);
  }
  const seenInFile = new Map<string, number>();
  const unknownGroups = new Map<string, string>();
  const unknownLevels = new Map<string, string>();
  /** Valeur inconnue, retenue sous sa première orthographe rencontrée. */
  const remember = (map: Map<string, string>, value: string) => {
    const key = normalizeText(value);
    if (!map.has(key)) map.set(key, value);
  };

  const planned = rows.map((row): PlannedRow => {
    const raw = Object.fromEntries(
      IMPORT_FIELDS.map((f) => {
        const column = mapping[f.key];
        return [f.key, column === null ? "" : (row.cells[column] ?? "").trim()];
      }),
    ) as Record<ImportFieldKey, string>;
    const errors: string[] = [];
    const warnings: string[] = [];

    let birthDate = "";
    if (raw.birthDate !== "") {
      const parsed = parseImportDate(raw.birthDate, options.today);
      if (parsed) birthDate = parsed;
      else errors.push(`Date de naissance : « ${raw.birthDate} » n'est pas une date valide.`);
    }

    let levelId = "";
    if (raw.level !== "") {
      const id = levelsByLabel.get(normalizeText(raw.level));
      if (id) levelId = id;
      else {
        warnings.push(`Niveau inconnu « ${raw.level} » : laissé vide.`);
        remember(unknownLevels, raw.level);
      }
    }

    const groups = resolveGroups(raw.groups, groupsByName);
    for (const name of groups.unknown) {
      warnings.push(`Groupe inconnu « ${name} » : l'élève n'y est pas inscrit.`);
      remember(unknownGroups, name);
    }

    const result = validate(studentSchema, {
      lastName: raw.lastName,
      firstName: raw.firstName,
      phone: normalizePhone(raw.phone),
      birthDate,
      levelId,
      fftRanking: raw.fftRanking,
      email: raw.email,
      guardianName: raw.guardianName,
      guardianPhone: normalizePhone(raw.guardianPhone),
    });
    if (!result.ok) {
      for (const field of STUDENT_FIELDS) {
        const message = result.errors[field];
        if (message) errors.push(`${SCHEMA_FIELD_LABELS[field]} : ${lowerFirst(message)}`);
      }
    }

    const base = {
      line: row.line,
      raw,
      groupIds: groups.ids,
      changes: {},
      newGroupIds: [],
      warnings,
    };
    if (!result.ok || errors.length > 0) {
      return { ...base, status: "error", values: null, existingId: null, errors };
    }

    const values = result.data;
    const key = identityKey(values);
    const firstLine = seenInFile.get(key);
    if (firstLine !== undefined) {
      return {
        ...base,
        status: "error",
        values,
        existingId: null,
        errors: [`Doublon de la ligne ${firstLine} du fichier.`],
      };
    }
    seenInFile.set(key, row.line);

    const existing = existingByKey.get(key);
    if (!existing) {
      return {
        ...base,
        status: "create",
        values,
        existingId: null,
        errors,
        newGroupIds: groups.ids,
      };
    }
    if (duplicates === "ignore") {
      return { ...base, status: "duplicate", values, existingId: existing.id, errors };
    }
    // Mise à jour : seules les colonnes associées et renseignées remplacent les valeurs.
    const changes: Partial<StudentValues> = {};
    for (const [importKey, field] of Object.entries(IMPORT_TO_STUDENT_FIELD) as [
      ImportFieldKey,
      (typeof UPDATABLE_FIELDS)[number],
    ][]) {
      const value = values[field];
      if (mapping[importKey] === null || value === null || value === existing[field]) continue;
      changes[field] = value;
    }
    const current = membershipsOf.get(existing.id);
    const newGroupIds = groups.ids.filter((id) => !current?.has(id));
    const changed = Object.keys(changes).length > 0 || newGroupIds.length > 0;
    return {
      ...base,
      status: changed ? "update" : "unchanged",
      values,
      existingId: existing.id,
      errors,
      changes,
      newGroupIds,
    };
  });

  const counts: Record<RowStatus, number> = {
    create: 0,
    update: 0,
    unchanged: 0,
    duplicate: 0,
    error: 0,
  };
  for (const row of planned) counts[row.status]++;
  const sorted = (map: Map<string, string>) =>
    [...map.values()].sort((a, b) => a.localeCompare(b, "fr"));
  return {
    rows: planned,
    counts,
    unknownGroups: sorted(unknownGroups),
    unknownLevels: sorted(unknownLevels),
  };
}

// ---------------------------------------------------------------------------
// Commande d'import
// ---------------------------------------------------------------------------

/**
 * Mutation des tables `students` et `group_students`. Une inscription est
 * désignée par le couple groupe + élève, et non par son identifiant : la
 * fiche élève recrée les inscriptions à chaque enregistrement. Son insertion
 * est ignorée si le couple existe déjà.
 */
export type StudentMutation =
  | { op: "insert"; table: "students"; row: Student }
  | { op: "update"; table: "students"; id: string; values: Partial<Student> }
  | { op: "delete"; table: "students"; id: string }
  | { op: "insert"; table: "groupStudents"; row: GroupStudent }
  | { op: "delete"; table: "groupStudents"; groupId: string; studentId: string };

export type ImportCommand = Command<StudentMutation>;

export interface ImportSummary {
  created: number;
  updated: number;
  memberships: number;
}

/** Libellé de la commande : « Import de 12 élèves (eleves.csv) ». */
export function importLabel(summary: ImportSummary, fileName?: string): string {
  const count = summary.created + summary.updated;
  const subject = `${count} élève${count > 1 ? "s" : ""}`;
  return fileName ? `Import de ${subject} (${fileName})` : `Import de ${subject}`;
}

/**
 * Commande réalisant l'import : création des nouveaux élèves, mise à jour des
 * doublons (mode « mettre à jour ») et inscription dans les groupes. Le sens
 * inverse supprime les inscriptions et les élèves créés, puis rétablit les
 * valeurs d'origine des élèves mis à jour.
 */
export function buildImportCommand(
  plan: ImportPlan,
  context: Pick<ImportContext, "seasonId" | "students">,
  options: { fileName?: string; ctx?: CommandContext } = {},
): { command: ImportCommand; summary: ImportSummary } {
  const ctx = options.ctx ?? defaultCommandContext;
  const now = ctx.now();
  const studentsById = new Map(context.students.map((s) => [s.id, s]));
  const inserts: Student[] = [];
  const updates: StudentMutation[] = [];
  const restores: StudentMutation[] = [];
  const memberships: GroupStudent[] = [];
  const summary: ImportSummary = { created: 0, updated: 0, memberships: 0 };

  const addMemberships = (studentId: string, groupIds: readonly string[]) => {
    for (const groupId of groupIds) {
      memberships.push({ id: ctx.newId(), groupId, studentId, createdAt: now, updatedAt: now });
    }
  };

  for (const row of plan.rows) {
    if (row.status === "create" && row.values) {
      const student: Student = {
        id: ctx.newId(),
        seasonId: context.seasonId,
        ...row.values,
        createdAt: now,
        updatedAt: now,
      };
      inserts.push(student);
      addMemberships(student.id, row.newGroupIds);
      summary.created++;
    } else if (row.status === "update" && row.existingId) {
      const existing = studentsById.get(row.existingId);
      if (!existing) continue;
      if (Object.keys(row.changes).length > 0) {
        const values: Partial<Student> = { ...row.changes, updatedAt: now };
        const previous = Object.fromEntries(
          Object.keys(values).map((key) => [key, existing[key as keyof Student]]),
        ) as Partial<Student>;
        updates.push({ op: "update", table: "students", id: existing.id, values });
        restores.push({ op: "update", table: "students", id: existing.id, values: previous });
      }
      addMemberships(existing.id, row.newGroupIds);
      summary.updated++;
    }
  }
  summary.memberships = memberships.length;

  const forward: StudentMutation[] = [
    ...inserts.map((row): StudentMutation => ({ op: "insert", table: "students", row })),
    ...updates,
    ...memberships.map((row): StudentMutation => ({ op: "insert", table: "groupStudents", row })),
  ];
  const backward: StudentMutation[] = [
    ...memberships.map(
      ({ groupId, studentId }): StudentMutation => ({
        op: "delete",
        table: "groupStudents",
        groupId,
        studentId,
      }),
    ),
    ...inserts.map((row): StudentMutation => ({ op: "delete", table: "students", id: row.id })),
    ...restores,
  ];
  return {
    command: { label: importLabel(summary, options.fileName), forward, backward },
    summary,
  };
}

/** État actuel, en base, des élèves concernés par un import. */
export interface ImportFootprint {
  students: readonly Pick<Student, "id" | "updatedAt">[];
  memberships: readonly Pick<GroupStudent, "groupId" | "studentId">[];
}

/** Élèves créés ou modifiés par un import (avec la date de modification qu'il leur a donnée). */
export function importedStudents(command: ImportCommand): {
  created: Map<string, string>;
  updated: Map<string, string>;
} {
  const created = new Map<string, string>();
  const updated = new Map<string, string>();
  for (const mutation of command.forward) {
    if (mutation.table !== "students") continue;
    if (mutation.op === "insert") created.set(mutation.row.id, mutation.row.updatedAt);
    else if (mutation.op === "update" && mutation.values.updatedAt) {
      updated.set(mutation.id, mutation.values.updatedAt);
    }
  }
  return { created, updated };
}

/**
 * Élèves modifiés depuis l'import (fiche enregistrée, ou inscription d'un
 * élève créé par l'import dans un autre groupe) : l'annulation effacerait ces
 * modifications. Un élève supprimé depuis n'est pas concerné.
 */
export function modifiedSinceImport(command: ImportCommand, current: ImportFootprint): string[] {
  const { created, updated } = importedStudents(command);
  const modified = new Set<string>();
  for (const student of current.students) {
    const stamp = created.get(student.id) ?? updated.get(student.id);
    if (stamp !== undefined && student.updatedAt !== stamp) modified.add(student.id);
  }
  const imported = new Set(
    command.forward.flatMap((m) =>
      m.op === "insert" && m.table === "groupStudents"
        ? [`${m.row.groupId}|${m.row.studentId}`]
        : [],
    ),
  );
  for (const { groupId, studentId } of current.memberships) {
    if (created.has(studentId) && !imported.has(`${groupId}|${studentId}`)) modified.add(studentId);
  }
  return [...modified];
}
