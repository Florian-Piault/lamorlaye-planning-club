import { describe, expect, it } from "vitest";
import {
  ageRangeLabel,
  ageRangeWarning,
  courtNameMessage,
  courtWithSameName,
  describeStudent,
  findStudentDuplicates,
  homonymKeys,
  initialsConflict,
  inSeasonDuplicateMessage,
  isOutOfAgeRange,
  isSameStudent,
  pastSeasonDuplicateMessage,
  reuseDetails,
  type StudentCandidate,
} from "./duplicates";

const CURRENT = "s2";

function candidate(patch: Partial<StudentCandidate> & { id: string }): StudentCandidate {
  return {
    seasonId: CURRENT,
    seasonName: "2026-2027",
    seasonStartDate: "2026-09-01",
    lastName: "Martin",
    firstName: "Léa",
    birthDate: null,
    groups: [],
    ...patch,
  };
}

const OPTIONS = { seasonId: CURRENT, seasonStartDate: "2026-09-01" };
const past = { seasonId: "s1", seasonName: "2025-2026", seasonStartDate: "2025-09-01" };
const older = { seasonId: "s0", seasonName: "2024-2025", seasonStartDate: "2024-09-01" };

describe("doublons d'élève", () => {
  it("compare nom et prénom sans casse ni accents", () => {
    const lea = { lastName: "Martin", firstName: "Léa", birthDate: null };
    expect(isSameStudent(lea, { lastName: " MARTIN ", firstName: "lea", birthDate: null })).toBe(
      true,
    );
    expect(isSameStudent(lea, { lastName: "Martin", firstName: "Léo", birthDate: null })).toBe(
      false,
    );
  });

  it("compare les dates seulement si les deux sont connues", () => {
    const born = { lastName: "Martin", firstName: "Léa", birthDate: "2015-05-03" };
    expect(isSameStudent(born, { ...born })).toBe(true);
    expect(isSameStudent(born, { ...born, birthDate: "2016-01-01" })).toBe(false);
    // Une date absente (ou vide dans le formulaire) ne départage pas.
    expect(isSameStudent(born, { ...born, birthDate: null })).toBe(true);
    expect(isSameStudent({ ...born, birthDate: "" }, born)).toBe(true);
  });

  it("distingue la saison en cours des saisons passées, la plus récente d'abord", () => {
    const candidates = [
      candidate({ id: "old", ...older }),
      candidate({ id: "here", groups: ["Galaxie vert"] }),
      candidate({ id: "last", ...past }),
      candidate({ id: "other", firstName: "Tom" }),
      // Saison suivante : ni dans la saison, ni « passée ».
      candidate({
        id: "next",
        seasonId: "s3",
        seasonName: "2027-2028",
        seasonStartDate: "2027-09-01",
        nameKey: "martin|lea",
      }),
    ];
    const found = findStudentDuplicates(
      { lastName: "martin", firstName: "LEA", birthDate: "" },
      candidates,
      OPTIONS,
    );
    expect(found.inSeason.map((c) => c.id)).toEqual(["here"]);
    expect(found.pastSeasons.map((c) => c.id)).toEqual(["last", "old"]);
  });

  it("trouve un doublon seulement dans une saison passée", () => {
    const found = findStudentDuplicates(
      { lastName: "Martin", firstName: "Léa", birthDate: "2015-05-03" },
      [
        candidate({ id: "last", ...past, birthDate: "2015-05-03" }),
        candidate({ id: "twin", birthDate: "2017-02-02" }),
      ],
      OPTIONS,
    );
    expect(found.inSeason).toEqual([]);
    expect(found.pastSeasons.map((c) => c.id)).toEqual(["last"]);
  });

  it("exclut la fiche éditée et attend nom et prénom", () => {
    const candidates = [candidate({ id: "me" })];
    expect(
      findStudentDuplicates({ lastName: "Martin", firstName: "Léa", birthDate: null }, candidates, {
        ...OPTIONS,
        excludeId: "me",
      }).inSeason,
    ).toEqual([]);
    expect(
      findStudentDuplicates(
        { lastName: "Martin", firstName: " ", birthDate: null },
        candidates,
        OPTIONS,
      ).inSeason,
    ).toEqual([]);
  });

  it("rédige les messages et désigne les homonymes", () => {
    const lea = candidate({ id: "x", birthDate: "2015-05-03", groups: ["Galaxie vert"] });
    expect(inSeasonDuplicateMessage(lea)).toBe(
      "Un élève Martin Léa (né(e) le 03/05/2015, Galaxie vert) existe déjà",
    );
    expect(inSeasonDuplicateMessage(candidate({ id: "y" }))).toBe(
      "Un élève Martin Léa existe déjà",
    );
    expect(pastSeasonDuplicateMessage(candidate({ id: "z", ...past }))).toBe(
      "Léa Martin était inscrit(e) en 2025-2026.",
    );
    expect(describeStudent(lea, false)).toBe("Martin Léa");
    expect([
      ...homonymKeys([
        { lastName: "Martin", firstName: "Léa" },
        { lastName: "MARTIN", firstName: "lea" },
        { lastName: "Durand", firstName: "Tom" },
      ]),
    ]).toEqual(["martin|lea"]);
  });

  it("reprend les coordonnées connues, sans toucher au nom", () => {
    const values = {
      lastName: "Martin",
      firstName: "Léa",
      phone: "06 99",
      birthDate: "",
      levelId: "",
      fftRanking: "",
      email: "",
      guardianName: "",
      guardianPhone: "",
    };
    expect(
      reuseDetails(values, {
        // Fiche complète d'une saison passée : ni le nom ni les groupes ne sont repris.
        ...candidate({ id: "old", ...past, lastName: "Autre", groups: ["Galaxie vert"] }),
        phone: "06 11 22 33 44",
        email: null,
        birthDate: "2015-05-03",
        guardianName: "Paul Martin",
        guardianPhone: "06 55",
        levelId: "lvl",
        fftRanking: "30/2",
      }),
    ).toEqual({
      ...values,
      phone: "06 11 22 33 44",
      birthDate: "2015-05-03",
      guardianName: "Paul Martin",
      guardianPhone: "06 55",
      levelId: "lvl",
      fftRanking: "30/2",
    });
  });
});

describe("initiales déjà prises (B2)", () => {
  const others = [{ initials: "JM", firstName: "Jean", lastName: "Martin" }];

  it("propose des initiales libres", () => {
    expect(
      initialsConflict({ initials: "jm", firstName: "Julie", lastName: "Morel" }, others),
    ).toEqual({
      owner: others[0],
      proposal: "JMo",
      message: "jm est déjà utilisé par Jean Martin. Utiliser JMo ?",
    });
  });

  it("ne dit rien si les initiales sont libres ou vides", () => {
    expect(
      initialsConflict({ initials: "JMo", firstName: "Julie", lastName: "Morel" }, others),
    ).toBeNull();
    expect(
      initialsConflict({ initials: " ", firstName: "Julie", lastName: "Morel" }, others),
    ).toBeNull();
  });

  it("avertit sans proposition sans nom", () => {
    expect(initialsConflict({ initials: "JM", firstName: "", lastName: "" }, others)?.message).toBe(
      "JM est déjà utilisé par Jean Martin.",
    );
  });
});

describe("nom de court déjà pris (B5)", () => {
  const courts = [
    { id: "c1", name: "Court 1" },
    { id: "c2", name: "Court Éole" },
  ];

  it("compare sans casse ni accents, fiche éditée exclue", () => {
    expect(courtWithSameName("court eole", courts)?.id).toBe("c2");
    expect(courtWithSameName("Court Éole", courts, "c2")).toBeNull();
    expect(courtWithSameName("Court 3", courts)).toBeNull();
    expect(courtWithSameName("  ", courts)).toBeNull();
    expect(courtNameMessage(courts[0] as { name: string })).toBe(
      "Un court « Court 1 » existe déjà",
    );
  });
});

describe("tranche d'âge au début de saison", () => {
  const start = "2026-09-01";
  const group = { name: "Galaxie vert", minAge: 6, maxAge: 8 };

  it.each([
    // 6 ans pile le jour du début de saison : dans la tranche.
    ["2020-09-01", false],
    // 6 ans le lendemain : encore 5 ans au début de saison.
    ["2020-09-02", true],
    // 8 ans révolus, 9 ans le lendemain : dans la tranche.
    ["2017-09-02", false],
    // 9 ans le jour du début de saison : hors tranche.
    ["2017-09-01", true],
  ])("née le %s → hors tranche : %s", (birthDate, out) => {
    expect(isOutOfAgeRange(group, birthDate, start)).toBe(out);
  });

  it("ne signale rien sans date ni tranche", () => {
    expect(isOutOfAgeRange(group, null, start)).toBe(false);
    expect(isOutOfAgeRange(group, "", start)).toBe(false);
    expect(isOutOfAgeRange({ minAge: null, maxAge: null }, "2024-01-01", start)).toBe(false);
  });

  it("rédige l'avertissement et la tranche", () => {
    expect(ageRangeWarning({ firstName: "Léa", birthDate: "2015-05-03" }, group, start)).toBe(
      "Léa aura 11 ans, Galaxie vert est pour les 6–8 ans",
    );
    expect(ageRangeWarning({ firstName: "Léa", birthDate: "2019-05-03" }, group, start)).toBeNull();
    expect(ageRangeLabel({ minAge: 18, maxAge: null })).toBe("18 ans et plus");
    expect(ageRangeLabel({ minAge: null, maxAge: 10 })).toBe("10 ans et moins");
    expect(ageRangeLabel({ minAge: null, maxAge: null })).toBeNull();
  });
});
