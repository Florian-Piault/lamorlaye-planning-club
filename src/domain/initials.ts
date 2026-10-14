/**
 * Initiales des moniteurs (SPECS.md §3.3, §6) : calculées à partir du prénom
 * et du nom, modifiables ensuite. Elles sont toujours affichées sur les cours
 * (daltoniens, impression en noir et blanc), d'où l'intérêt qu'elles soient
 * uniques dans la saison.
 */

/** Particules ignorées lorsqu'elles sont écrites en minuscules (« de La Fontaine »). */
const PARTICLES = new Set(["de", "du", "des", "d", "l", "van", "von", "der", "den", "di", "da"]);

function words(value: string): string[] {
  return value
    .trim()
    .split(/[\s\-'’]+/)
    .filter((word) => word.length > 0);
}

function firstLetter(word: string): string {
  return (word.match(/\p{L}/u)?.[0] ?? "").toUpperCase();
}

/** Mots significatifs du nom de famille (sans les particules en minuscules). */
function significantLastNameWords(lastName: string): string[] {
  const all = words(lastName);
  const significant = all.filter((word) => !(word === word.toLowerCase() && PARTICLES.has(word)));
  return significant.length > 0 ? significant : all;
}

/**
 * Initiales : une lettre par partie du prénom (« Jean-Pierre » → « JP »),
 * puis la première lettre du nom, particules ignorées.
 *
 * @example computeInitials("Karim", "Benali") === "KB"
 * @example computeInitials("Jean-Pierre", "de La Fontaine") === "JPL"
 */
export function computeInitials(firstName: string, lastName: string): string {
  const first = words(firstName).slice(0, 2).map(firstLetter).join("");
  const last = firstLetter(significantLastNameWords(lastName)[0] ?? "");
  return first + last;
}

/**
 * Initiales proposées pour un moniteur, différentes de celles déjà prises
 * (comparaison sans tenir compte de la casse) :
 * « KB » → « KBe » (lettre suivante du nom) → « KB2 », « KB3 »…
 */
export function suggestInitials(
  firstName: string,
  lastName: string,
  taken: readonly string[],
): string {
  const base = computeInitials(firstName, lastName);
  if (base === "") return "";
  const used = new Set(taken.map((t) => t.trim().toUpperCase()));
  if (!used.has(base.toUpperCase())) return base;

  const lastWord = significantLastNameWords(lastName)[0] ?? "";
  const letters = [...lastWord].filter((c) => /\p{L}/u.test(c)).slice(1);
  for (const letter of letters) {
    const candidate = base + letter.toLowerCase();
    if (!used.has(candidate.toUpperCase())) return candidate;
  }
  for (let n = 2; ; n++) {
    const candidate = `${base}${n}`;
    if (!used.has(candidate.toUpperCase())) return candidate;
  }
}
