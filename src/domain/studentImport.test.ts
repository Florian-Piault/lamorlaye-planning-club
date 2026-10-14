import { describe, expect, it } from "vitest";
import type { Student } from "@/db/schema";
import type { CommandContext } from "./commands";
import type { TableRow } from "./importFile";
import {
  buildImportCommand,
  type ColumnMapping,
  emptyMapping,
  fieldLabel,
  guessMapping,
  type ImportContext,
  identityKey,
  importedStudents,
  importLabel,
  mappingProblems,
  modifiedSinceImport,
  normalizeHeader,
  normalizePhone,
  parseImportDate,
  planImport,
  restoreMapping,
  toSavedMapping,
} from "./studentImport";

const HEADERS = [
  "NOM",
  "Prénom",
  "Tél. portable",
  "Né(e) le",
  "Niveau",
  "Classement",
  "E-mail",
  "Nom du responsable légal",
  "Téléphone du responsable",
  "Groupe",
];

/** Correspondance des colonnes de `HEADERS`, dans l'ordre. */
const MAPPING: ColumnMapping = {
  lastName: 0,
  firstName: 1,
  phone: 2,
  birthDate: 3,
  level: 4,
  fftRanking: 5,
  email: 6,
  guardianName: 7,
  guardianPhone: 8,
  groups: 9,
};

const TODAY = new Date(2026, 9, 14);

function student(id: string, values: Partial<Student> = {}): Student {
  return {
    id,
    seasonId: "s1",
    lastName: "Martin",
    firstName: "Léa",
    phone: "0611223344",
    birthDate: "2015-01-05",
    levelId: null,
    fftRanking: null,
    email: null,
    guardianName: null,
    guardianPhone: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...values,
  };
}

const context: ImportContext = {
  seasonId: "s1",
  students: [student("existing"), student("other", { lastName: "Durand", firstName: "Tom" })],
  groups: [
    { id: "g1", name: "Galaxie vert 1" },
    { id: "g2", name: "Adultes, mardi" },
    { id: "g3", name: "Compétition" },
  ],
  levels: [
    { id: "l-vert", label: "Galaxie vert" },
    { id: "l-deb", label: "Débutant" },
  ],
  memberships: [{ groupId: "g1", studentId: "existing" }],
};

const row = (line: number, cells: string[]): TableRow => ({ line, cells });

/** Ligne complète et valide, modifiable champ par champ. */
function line(line: number, values: Partial<Record<keyof ColumnMapping, string>> = {}): TableRow {
  const base: Record<keyof ColumnMapping, string> = {
    lastName: "Éluard",
    firstName: "Zoé",
    phone: "06 33 44 55 66",
    birthDate: "05/01/2017",
    level: "",
    fftRanking: "",
    email: "",
    guardianName: "",
    guardianPhone: "",
    groups: "",
    ...values,
  };
  return row(
    line,
    (Object.keys(MAPPING) as (keyof ColumnMapping)[]).map((key) => base[key]),
  );
}

let counter = 0;
const ctx: CommandContext = {
  newId: () => `id-${++counter}`,
  now: () => "2026-10-14T10:00:00.000Z",
};

describe("correspondance des colonnes", () => {
  it("reconnaît les en-têtes usuels", () => {
    expect(guessMapping(HEADERS)).toEqual(MAPPING);
  });

  it("reconnaît des en-têtes composés et n'associe une colonne qu'une fois", () => {
    expect(
      guessMapping(["Nom de l'adhérent", "Prénom adhérent", "Tel", "Adresse mail", "Téléphone"]),
    ).toMatchObject({ lastName: 0, firstName: 1, phone: 2, email: 3, guardianPhone: null });
    expect(guessMapping(["Nom", "Nom"])).toMatchObject({ lastName: 0, guardianName: null });
    expect(guessMapping(["Colonne A"])).toEqual(emptyMapping());
  });

  it("normalise les en-têtes", () => {
    expect(normalizeHeader("  Tél. Portable ")).toBe("tel portable");
    expect(normalizeHeader("Né(e) le")).toBe("ne e le");
  });

  it("mémorise la correspondance par nom d'en-tête et la restaure", () => {
    const headers = ["Famille", "Prénom", "Portable", "Groupe"];
    const mapping = { ...guessMapping(headers), lastName: 0, groups: null };
    const saved = toSavedMapping(headers, mapping);
    expect(saved).toMatchObject({ lastName: "Famille", phone: "Portable", groups: null });

    // Colonnes dans un autre ordre : la correspondance suit les en-têtes.
    const restored = restoreMapping(["Groupe", "portable", "FAMILLE", "Prénom", "Mail"], saved);
    expect(restored).toMatchObject({
      lastName: 2,
      firstName: 3,
      phone: 1,
      groups: null,
      email: 4,
    });
    expect(restoreMapping(headers, null)).toEqual(guessMapping(headers));
    // En-tête mémorisé absent : correspondance automatique.
    expect(restoreMapping(["Nom", "Prénom"], { lastName: "Famille" })).toMatchObject({
      lastName: 0,
      firstName: 1,
    });
  });

  it("signale les champs obligatoires non associés", () => {
    expect(mappingProblems(MAPPING)).toEqual([]);
    expect(mappingProblems({ ...MAPPING, phone: null, lastName: null })).toEqual([
      "Choisissez la colonne du champ « Nom ».",
      "Choisissez la colonne du champ « Téléphone ».",
    ]);
    expect(fieldLabel("guardianPhone")).toBe("Téléphone du responsable");
  });
});

describe("valeurs", () => {
  it("lit les dates usuelles", () => {
    expect(parseImportDate("2015-01-05")).toBe("2015-01-05");
    expect(parseImportDate("2015/1/5")).toBe("2015-01-05");
    expect(parseImportDate("05/01/2015")).toBe("2015-01-05");
    expect(parseImportDate("5-1-2015")).toBe("2015-01-05");
    expect(parseImportDate("05.01.2015")).toBe("2015-01-05");
    expect(parseImportDate("05/01/2015 00:00")).toBe("2015-01-05");
    expect(parseImportDate("05/01/15", TODAY)).toBe("2015-01-05");
    expect(parseImportDate("05/01/48", TODAY)).toBe("1948-01-05");
    expect(parseImportDate("31/02/2015")).toBeNull();
    expect(parseImportDate("hier")).toBeNull();
    expect(parseImportDate("")).toBeNull();
  });

  it("rétablit le zéro initial des numéros perdus par Excel", () => {
    expect(normalizePhone("611223344")).toBe("0611223344");
    expect(normalizePhone(" 06 11 22 33 44 ")).toBe("06 11 22 33 44");
    expect(normalizePhone("+33611223344")).toBe("+33611223344");
  });

  it("compare les identités sans casse ni accents", () => {
    expect(identityKey({ lastName: "ÉLUARD", firstName: "zoe", birthDate: "2017-01-05" })).toBe(
      identityKey({ lastName: "Éluard ", firstName: "Zoé", birthDate: "2017-01-05" }),
    );
    expect(identityKey({ lastName: "A", firstName: "B", birthDate: null })).toBe("a|b|");
  });
});

describe("planImport", () => {
  const options = { mapping: MAPPING, duplicates: "ignore" as const, today: TODAY };

  it("prévoit la création des élèves valides, avec niveau et groupes", () => {
    const plan = planImport(
      [
        line(2, {
          level: "galaxie VERT",
          email: " zoe@example.fr ",
          groups: "galaxie vert 1",
          guardianName: "Paul Éluard",
          guardianPhone: "622334455",
          fftRanking: "NC",
        }),
      ],
      context,
      options,
    );
    expect(plan.counts).toEqual({ create: 1, update: 0, unchanged: 0, duplicate: 0, error: 0 });
    expect(plan.rows[0]).toMatchObject({
      line: 2,
      status: "create",
      values: {
        lastName: "Éluard",
        firstName: "Zoé",
        phone: "06 33 44 55 66",
        birthDate: "2017-01-05",
        levelId: "l-vert",
        fftRanking: "NC",
        email: "zoe@example.fr",
        guardianName: "Paul Éluard",
        guardianPhone: "0622334455",
      },
      groupIds: ["g1"],
      newGroupIds: ["g1"],
      errors: [],
      warnings: [],
    });
  });

  it("signale les lignes invalides sans bloquer les autres", () => {
    const plan = planImport(
      [
        line(2, { phone: "" }),
        line(3, { firstName: "Tom", birthDate: "31/02/2015", email: "tom@" }),
        line(4, { firstName: "Max", guardianPhone: "abc" }),
        line(5, { firstName: "Léo" }),
      ],
      context,
      options,
    );
    expect(plan.rows.map((r) => r.status)).toEqual(["error", "error", "error", "create"]);
    expect(plan.rows[0]?.errors).toEqual(["Téléphone : le téléphone est obligatoire."]);
    expect(plan.rows[1]?.errors).toEqual([
      "Date de naissance : « 31/02/2015 » n'est pas une date valide.",
      "E-mail : adresse e-mail invalide.",
    ]);
    expect(plan.rows[2]?.errors).toEqual([
      "Téléphone du responsable : numéro de téléphone invalide.",
    ]);
    expect(plan.counts.error).toBe(3);
  });

  it("signale les groupes et niveaux inconnus sans bloquer la ligne", () => {
    const plan = planImport(
      [
        line(2, { groups: "Adultes, mardi" }),
        line(3, {
          firstName: "Tom",
          groups: "Galaxie vert 1; Compétition | Inconnu",
          level: "Expert",
        }),
        line(4, { firstName: "Max", groups: "Zumba, inconnu" }),
      ],
      context,
      options,
    );
    expect(plan.rows.map((r) => r.status)).toEqual(["create", "create", "create"]);
    expect(plan.rows[0]?.groupIds).toEqual(["g2"]);
    expect(plan.rows[1]?.groupIds).toEqual(["g1", "g3"]);
    expect(plan.rows[1]?.warnings).toEqual([
      "Niveau inconnu « Expert » : laissé vide.",
      "Groupe inconnu « Inconnu » : l'élève n'y est pas inscrit.",
    ]);
    expect(plan.unknownGroups).toEqual(["Inconnu", "Zumba"]);
    expect(plan.unknownLevels).toEqual(["Expert"]);
  });

  it("ignore les élèves déjà enregistrés et les doublons du fichier", () => {
    const plan = planImport(
      [
        line(2, { lastName: "MARTIN", firstName: "lea", birthDate: "2015-01-05" }),
        line(3),
        line(4, { lastName: "eluard", firstName: "ZOE" }),
        line(5, { lastName: "Durand", firstName: "Tom", birthDate: "" }),
      ],
      context,
      options,
    );
    expect(plan.rows.map((r) => r.status)).toEqual(["duplicate", "create", "error", "create"]);
    expect(plan.rows[0]?.existingId).toBe("existing");
    expect(plan.rows[2]?.errors).toEqual(["Doublon de la ligne 3 du fichier."]);
    // Même nom mais date de naissance différente (absente) : un autre élève.
    expect(plan.rows[3]?.existingId).toBeNull();
  });

  it("met à jour les élèves déjà enregistrés avec les seules valeurs renseignées", () => {
    const plan = planImport(
      [
        line(2, {
          lastName: "Martin",
          firstName: "Léa",
          birthDate: "05/01/2015",
          phone: "07 00 00 00 00",
          email: "",
          level: "Débutant",
          groups: "Galaxie vert 1, Compétition",
        }),
        line(3, {
          lastName: "Martin",
          firstName: "Léa",
          birthDate: "05/01/2015",
          phone: "0611223344",
        }),
      ],
      { ...context, students: [context.students[0] as Student] },
      { ...options, duplicates: "update" },
    );
    expect(plan.rows[0]).toMatchObject({
      status: "update",
      existingId: "existing",
      changes: { phone: "07 00 00 00 00", levelId: "l-deb" },
      newGroupIds: ["g3"],
    });
    expect(plan.rows[0]?.changes).not.toHaveProperty("email");
    expect(plan.rows[1]?.status).toBe("error");

    const unchanged = planImport(
      [
        line(2, {
          lastName: "Martin",
          firstName: "Léa",
          birthDate: "05/01/2015",
          phone: "0611223344",
        }),
      ],
      context,
      { mapping: { ...MAPPING, email: null }, duplicates: "update", today: TODAY },
    );
    expect(unchanged.rows[0]?.status).toBe("unchanged");
    expect(unchanged.counts.unchanged).toBe(1);
  });

  it("n'importe que les colonnes associées", () => {
    const mapping = { ...emptyMapping(), lastName: 0, firstName: 1, phone: 2 };
    const plan = planImport([row(2, ["Martin", "Tom", "0611223344", "ignoré"])], context, {
      mapping,
      duplicates: "ignore",
    });
    expect(plan.rows[0]?.values).toMatchObject({ birthDate: null, email: null, levelId: null });
  });
});

describe("buildImportCommand", () => {
  it("crée, met à jour et inscrit en une seule commande inversible", () => {
    counter = 0;
    const plan = planImport(
      [
        line(2, { groups: "Galaxie vert 1" }),
        line(3, {
          lastName: "Martin",
          firstName: "Léa",
          birthDate: "05/01/2015",
          phone: "07 00 00 00 00",
          groups: "Compétition",
        }),
        line(4, { phone: "" }),
      ],
      context,
      { mapping: MAPPING, duplicates: "update", today: TODAY },
    );
    const { command, summary } = buildImportCommand(plan, context, { fileName: "eleves.csv", ctx });
    expect(summary).toEqual({ created: 1, updated: 1, memberships: 2 });
    expect(command.label).toBe("Import de 2 élèves (eleves.csv)");
    expect(command.forward).toEqual([
      {
        op: "insert",
        table: "students",
        row: expect.objectContaining({
          id: "id-1",
          seasonId: "s1",
          lastName: "Éluard",
          createdAt: "2026-10-14T10:00:00.000Z",
        }),
      },
      {
        op: "update",
        table: "students",
        id: "existing",
        values: { phone: "07 00 00 00 00", updatedAt: "2026-10-14T10:00:00.000Z" },
      },
      {
        op: "insert",
        table: "groupStudents",
        row: expect.objectContaining({ id: "id-2", groupId: "g1", studentId: "id-1" }),
      },
      {
        op: "insert",
        table: "groupStudents",
        row: expect.objectContaining({ id: "id-3", groupId: "g3", studentId: "existing" }),
      },
    ]);
    expect(command.backward).toEqual([
      { op: "delete", table: "groupStudents", groupId: "g1", studentId: "id-1" },
      { op: "delete", table: "groupStudents", groupId: "g3", studentId: "existing" },
      { op: "delete", table: "students", id: "id-1" },
      {
        op: "update",
        table: "students",
        id: "existing",
        values: { phone: "0611223344", updatedAt: "2026-09-01T00:00:00.000Z" },
      },
    ]);
  });

  it("libelle l'import", () => {
    expect(importLabel({ created: 1, updated: 0, memberships: 0 })).toBe("Import de 1 élève");
    expect(importLabel({ created: 0, updated: 0, memberships: 0 })).toBe("Import de 0 élève");
  });

  it("utilise le contexte par défaut et ignore un élève disparu", () => {
    const plan = planImport(
      [
        line(2, {
          lastName: "Martin",
          firstName: "Léa",
          birthDate: "05/01/2015",
          groups: "Compétition",
        }),
      ],
      context,
      { mapping: MAPPING, duplicates: "update", today: TODAY },
    );
    const { command, summary } = buildImportCommand(plan, { seasonId: "s1", students: [] });
    expect(summary.updated).toBe(0);
    expect(command.forward).toEqual([]);
    const created = buildImportCommand(
      planImport([line(2)], context, { mapping: MAPPING, duplicates: "ignore" }),
      context,
    );
    expect(created.command.forward[0]).toMatchObject({ op: "insert", table: "students" });
  });
});

describe("modifiedSinceImport", () => {
  it("repère les élèves de l'import modifiés depuis", () => {
    counter = 0;
    const plan = planImport(
      [
        line(2, { groups: "Galaxie vert 1" }),
        line(3, {
          lastName: "Martin",
          firstName: "Léa",
          birthDate: "05/01/2015",
          phone: "07 00 00 00 00",
        }),
      ],
      context,
      { mapping: MAPPING, duplicates: "update", today: TODAY },
    );
    const { command } = buildImportCommand(plan, context, { ctx });
    const stamp = "2026-10-14T10:00:00.000Z";
    const untouched = {
      students: [
        { id: "id-1", updatedAt: stamp },
        { id: "existing", updatedAt: stamp },
      ],
      memberships: [{ groupId: "g1", studentId: "id-1" }],
    };
    expect(importedStudents(command)).toEqual({
      created: new Map([["id-1", stamp]]),
      updated: new Map([["existing", stamp]]),
    });
    expect(modifiedSinceImport(command, untouched)).toEqual([]);
    // Élève supprimé depuis : rien à protéger.
    expect(modifiedSinceImport(command, { students: [], memberships: [] })).toEqual([]);
    // Fiche enregistrée depuis.
    expect(
      modifiedSinceImport(command, {
        ...untouched,
        students: [{ id: "existing", updatedAt: "2026-10-15T08:00:00.000Z" }],
      }),
    ).toEqual(["existing"]);
    // Élève créé par l'import, inscrit depuis dans un autre groupe.
    expect(
      modifiedSinceImport(command, {
        ...untouched,
        memberships: [...untouched.memberships, { groupId: "g3", studentId: "id-1" }],
      }),
    ).toEqual(["id-1"]);
  });
});
