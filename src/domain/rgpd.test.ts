import { describe, expect, it } from "vitest";
import type { Student } from "@/db/schema";
import {
  buildStudentExport,
  groupPeople,
  type StudentRecord,
  samePerson,
  studentExportBytes,
  studentExportFileName,
} from "./rgpd";

const T = "2026-09-01T10:00:00.000Z";

function student(extra: Partial<Student> = {}): Student {
  return {
    id: "e1",
    seasonId: "s1",
    lastName: "Éluard",
    firstName: "Zoé",
    phone: "0600000000",
    birthDate: "2017-01-05",
    levelId: null,
    fftRanking: null,
    email: null,
    guardianName: null,
    guardianPhone: null,
    createdAt: T,
    updatedAt: T,
    ...extra,
  };
}

const season = (name: string, startDate: string, status: "active" | "archived") => ({
  id: name,
  name,
  startDate,
  endDate: startDate.replace(/^(\d{4})/, (y) => String(Number(y) + 1)),
  status,
});

describe("samePerson", () => {
  it("compare nom, prénom et date de naissance sans casse ni accents", () => {
    const candidates = [
      student({ id: "a", lastName: "ELUARD", firstName: "zoe" }),
      student({ id: "b", birthDate: "2018-01-05" }),
      student({ id: "c", firstName: "Zoéline" }),
    ];
    expect(samePerson(student(), candidates).map((c) => c.id)).toEqual(["a"]);
  });
});

describe("groupPeople", () => {
  it("regroupe les fiches par personne, triées par nom", () => {
    const people = groupPeople([
      {
        studentId: "1",
        lastName: "Martin",
        firstName: "Hugo",
        birthDate: null,
        seasonName: "A",
        seasonStartDate: "2026-09-01",
      },
      {
        studentId: "2",
        lastName: "Éluard",
        firstName: "Zoé",
        birthDate: "2017-01-05",
        seasonName: "A",
        seasonStartDate: "2026-09-01",
      },
      {
        studentId: "3",
        lastName: "ELUARD",
        firstName: "Zoe",
        birthDate: "2017-01-05",
        seasonName: "B",
        seasonStartDate: "2027-09-01",
      },
      {
        studentId: "4",
        lastName: "Eluard",
        firstName: "Zoé",
        birthDate: null,
        seasonName: "B",
        seasonStartDate: "2027-09-01",
      },
      {
        studentId: "5",
        lastName: "Eluard",
        firstName: "Anna",
        birthDate: null,
        seasonName: "B",
        seasonStartDate: "2027-09-01",
      },
    ]);
    expect(
      people.map((p) => [p.firstName, p.birthDate, p.records.map((r) => r.studentId)]),
    ).toEqual([
      ["Anna", null, ["5"]],
      ["Zoé", null, ["4"]],
      ["Zoé", "2017-01-05", ["3", "2"]],
      ["Hugo", null, ["1"]],
    ]);
  });
});

describe("export des données", () => {
  const records: StudentRecord[] = [
    {
      student: student({
        id: "b",
        seasonId: "s2",
        guardianName: "Paul Éluard",
        guardianPhone: "0611111111",
      }),
      season: season("2027-2028", "2027-09-01", "active"),
      levelLabel: "Galaxie vert",
      groups: [{ name: "Galaxie vert 1", levelLabel: "Galaxie vert" }],
    },
    {
      student: student({ id: "a" }),
      season: season("2026-2027", "2026-09-01", "archived"),
      levelLabel: null,
      groups: [],
    },
  ];

  it("présente la personne et ses fiches par saison, de la plus ancienne à la plus récente", () => {
    const document = buildStudentExport(records, "2027-10-01T08:00:00.000Z");
    expect(document.exportéLe).toBe("2027-10-01T08:00:00.000Z");
    expect(document.personne).toEqual({
      nom: "Éluard",
      prénom: "Zoé",
      dateDeNaissance: "2017-01-05",
    });
    expect(document.saisons.map((s) => [s.saison.nom, s.saison.statut])).toEqual([
      ["2026-2027", "terminée"],
      ["2027-2028", "en cours"],
    ]);
    expect(document.saisons[0]?.fiche.responsableLégal).toBeNull();
    expect(document.saisons[1]?.fiche).toMatchObject({
      niveau: "Galaxie vert",
      responsableLégal: { nom: "Paul Éluard", téléphone: "0611111111" },
    });
    expect(document.saisons[1]?.groupes).toEqual([
      { nom: "Galaxie vert 1", niveau: "Galaxie vert" },
    ]);
  });

  it("produit un JSON indenté en UTF-8", () => {
    const text = new TextDecoder().decode(studentExportBytes(records, T));
    expect(text).toContain('"prénom": "Zoé"');
    expect(text.endsWith("}\n")).toBe(true);
  });

  it("accepte une liste vide", () => {
    expect(buildStudentExport([], T)).toMatchObject({ personne: null, saisons: [] });
  });

  it("nomme le fichier d'après l'élève", () => {
    expect(studentExportFileName({ lastName: "Éluard", firstName: "Zoé Anne" })).toBe(
      "donnees-eluard-zoe-anne.json",
    );
    expect(studentExportFileName({ lastName: "!!", firstName: "" })).toBe("donnees-eleve.json");
  });
});
