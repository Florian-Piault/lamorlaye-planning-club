import { describe, expect, it } from "vitest";
import { isWrite } from "./changes";

describe("avis d'écriture", () => {
  it("une lecture n'est pas une écriture, même après espaces et commentaires", () => {
    expect(isWrite("select 1")).toBe(false);
    expect(isWrite("  SELECT count(*) from courts")).toBe(false);
    expect(isWrite("-- comptes\n select 1")).toBe(false);
    expect(isWrite("/* guidage */ select 1")).toBe(false);
  });

  it("tout le reste est signalé", () => {
    expect(isWrite('insert into "courts" values (?) returning "id"')).toBe(true);
    expect(isWrite("update seasons set name = ?")).toBe(true);
    expect(isWrite("delete from lessons")).toBe(true);
    expect(isWrite("replace into levels values (?)")).toBe(true);
    expect(isWrite("with x as (select 1) delete from lessons")).toBe(true);
    expect(isWrite("selector")).toBe(true);
  });
});
