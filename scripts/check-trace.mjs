#!/usr/bin/env node
/**
 * Contrôle des tableaux de traçabilité (`docs/TRACABILITE*.md`) : chaque fichier
 * de test cité existe, et chaque test cité (« describe › test ») a son titre dans
 * le fichier cité juste avant, dans la même cellule (sinon dans un fichier de test
 * quelconque). Un « … » abrège un titre : chaque morceau autour doit exister.
 *
 * Usage : node scripts/check-trace.mjs [fichiers…]
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const testFile = /\.(spec|test)\.tsx?$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (testFile.test(entry.name)) out.push(path);
  }
  return out;
}

const tests = [...walk("e2e"), ...walk("src")];
const sources = new Map(tests.map((path) => [path, readFileSync(join(root, path), "utf8")]));
const allSources = [...sources.values()].join("\n");

/** Titres paramétrés (`même règle dans ${form.name}`) : `${…}` vaut n'importe quel texte. */
const templated = [
  ...allSources.matchAll(/\b(?:test|it|describe)(?:\.\w+)?\(\s*`([^`]*\$\{[^`]*)`/g),
]
  .map((match) => match[1].split(/\$\{[^}]*\}/))
  // Un gabarit presque vide (`${name}`) accepterait n'importe quel titre.
  .filter((parts) => parts.join("").trim().length >= 10)
  .map(
    (parts) =>
      new RegExp(
        `^${parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+")}$`,
      ),
  );

/** Chemin complet d'une citation (`e2e/x.spec.ts`, `src/…`, ou nom seul). */
function resolve(cited) {
  if (sources.has(cited)) return [cited];
  const name = basename(cited);
  return tests.filter((path) => path.endsWith(cited) || basename(path) === name);
}

/**
 * Citations « … » de premier niveau, guillemets imbriqués compris. Celles entre
 * parenthèses commentent le test (libellés d'écran) : `aside`.
 */
function quotes(text) {
  const found = [];
  let depth = 0;
  let parens = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (depth === 0 && text[i] === "(") parens++;
    else if (depth === 0 && text[i] === ")" && parens > 0) parens--;
    else if (text[i] === "«") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "»" && depth > 0) {
      depth--;
      if (depth === 0)
        found.push({ at: start, aside: parens > 0, body: text.slice(start + 1, i).trim() });
    }
  }
  return found;
}

/** Le titre du test : dernier segment après « › », coupé sur les « … ». */
function titlePieces(body) {
  const segments = body.split(" › ");
  return segments[segments.length - 1]
    .split("…")
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);
}

const docs =
  process.argv.length > 2
    ? process.argv.slice(2)
    : readdirSync(join(root, "docs"))
        .filter((name) => /^TRACABILITE.*\.md$/.test(name))
        .map((name) => join("docs", name));

const errors = [];
let checked = 0;
for (const doc of docs) {
  const lines = readFileSync(join(root, doc), "utf8").split("\n");
  lines.forEach((line, index) => {
    const where = `${doc}:${index + 1}`;
    for (const cell of line.split(" | ")) {
      const files = [...cell.matchAll(/`([^`\s*]+\.(?:spec|test)\.tsx?)`/g)].map((match) => {
        const paths = resolve(match[1]);
        if (paths.length === 0)
          errors.push(`${where} : fichier de test introuvable \`${match[1]}\``);
        return { at: match.index, paths };
      });
      for (const quote of quotes(cell)) {
        // Un test se cite après son fichier, ou avec son describe (« … › titre »).
        const file = files.filter((f) => f.at < quote.at).pop();
        if (quote.aside || (!file && !quote.body.includes(" › "))) continue;
        checked++;
        const haystack = file?.paths.length
          ? file.paths.map((path) => sources.get(path)).join("\n")
          : allSources;
        for (const piece of titlePieces(quote.body)) {
          if (!haystack.includes(piece) && !templated.some((title) => title.test(piece))) {
            const scope = file?.paths.length ? file.paths.join(", ") : "les fichiers de test";
            errors.push(`${where} : test introuvable dans ${scope} : « ${piece} »`);
          }
        }
      }
    }
  });
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} citation(s) de traçabilité sans test correspondant.`);
  process.exit(1);
}
console.log(`Traçabilité : ${checked} tests cités dans ${docs.length} fichier(s), tous retrouvés.`);
